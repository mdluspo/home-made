import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { initialHome, validateHome, canMove, migrateHome, homeSpawn, normalizePlan } from './src/model.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/live', maxPayload: 12 * 1024 * 1024 });
const dataDir = new URL('./data/', import.meta.url);
await mkdir(dataDir, { recursive: true });
let db = { profiles: {}, homes: {} };
try { db = JSON.parse(await readFile(new URL('world.json', dataDir), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
let saveTimer, writeQueue = Promise.resolve();
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const snapshot = JSON.stringify(db);
    writeQueue = writeQueue.then(async () => {
      await writeFile(new URL('world.tmp', dataDir), snapshot);
      await rename(new URL('world.tmp', dataDir), new URL('world.json', dataDir));
    }).catch(e => console.error('Could not save world:', e));
  }, 200);
}
const token = () => randomBytes(24).toString('hex');
for (const home of Object.values(db.homes)) {
  const state=normalizePlan(migrateHome(home.state));
  if(JSON.stringify(state)!==JSON.stringify(home.state)){home.state=state;home.version++;persist();}
}
const safeProfile = p => ({ id: p.id, name: p.name, color: p.color, homeId: p.homeId, lotIndex:Object.keys(db.homes).indexOf(p.homeId) });
const findProfile = t => Object.values(db.profiles).find(p => p.token === t);
const roleFor = (home, p) => home.owner === p.id ? 'owner' : home.permissions[p.id] || (home.public ? 'viewer' : null);
const send = (ws, type, payload) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type, ...payload }));
function broadcast(homeId, type, payload, except) {
  for (const ws of wss.clients) if (ws.homeId === homeId && ws !== except) send(ws, type, payload);
}
function presence(homeId) {
  const players = [...wss.clients].filter(ws => ws.homeId === homeId && ws.profile).map(ws => ({ ...safeProfile(ws.profile), connectionId: ws.connectionId, position: ws.position || { x: 540, y: 575 }, role: ws.role }));
  broadcast(homeId, 'presence', { players });
}
function streetPresence(){
  const players=[...wss.clients].filter(w=>w.street&&w.readyState===WebSocket.OPEN).map(w=>({...safeProfile(w.profile),connectionId:w.connectionId,position:w.streetPosition}));
  for(const ws of wss.clients)if(ws.street)send(ws,'streetpresence',{players});
}
app.use(express.json({ limit: '12mb' }));
app.post('/api/session', (req, res) => {
  let profile = findProfile(req.body.token);
  if (!profile) {
    const id = randomUUID(), homeId = randomUUID();
    profile = { id, token: token(), name: 'Little dreamer', color: '#a2ad83', homeId };
    db.profiles[id] = profile;
    db.homes[homeId] = { id: homeId, owner: id, public: true, permissions: {}, invites: {}, version: 0, state: initialHome() };
    persist();
  }
  res.json({ profile: safeProfile(profile), token: profile.token });
});
app.use('/api', (req, res, next) => {
  req.profile = findProfile(req.headers.authorization?.replace('Bearer ', ''));
  if (!req.profile) return res.status(401).json({ error: 'Please reconnect to your home.' });
  next();
});
app.patch('/api/profile', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 24);
  if (!name) return res.status(400).json({ error: 'Your name needs a little something.' });
  req.profile.name = name;
  if (/^#[0-9a-f]{6}$/i.test(req.body.color)) req.profile.color = req.body.color;
  persist();
  for (const ws of wss.clients) if (ws.profile?.id === req.profile.id) presence(ws.homeId);
  res.json(safeProfile(req.profile));
});
app.get('/api/neighborhood', (req, res) => {
  res.json(Object.values(db.homes).map((h,lotIndex)=>({...h,lotIndex})).filter(h=>h.state.boundary.length>=3).map(h => ({ id: h.id, lotIndex:h.lotIndex, name: h.state.name, owner: safeProfile(db.profiles[h.owner]), public: h.public, visitors: [...wss.clients].filter(w => w.homeId === h.id).length, canVisit: !!roleFor(h, req.profile) })));
});
app.get('/api/homes/:id/access', (req, res) => {
  const home = db.homes[req.params.id];
  if (!home || home.owner !== req.profile.id) return res.status(403).json({ error: 'Only the homeowner can manage guests.' });
  res.json({ public: home.public, collaborators: Object.entries(home.permissions).map(([id, role]) => ({ ...safeProfile(db.profiles[id]), role })) });
});
app.patch('/api/homes/:id/access', (req, res) => {
  const home = db.homes[req.params.id];
  if (!home || home.owner !== req.profile.id) return res.status(403).json({ error: 'Only the homeowner can manage guests.' });
  if (typeof req.body.public === 'boolean') home.public = req.body.public;
  if (req.body.playerId && db.profiles[req.body.playerId] && req.body.playerId !== home.owner) {
    if (['viewer', 'decorator', 'builder'].includes(req.body.role)) home.permissions[req.body.playerId] = req.body.role;
    else delete home.permissions[req.body.playerId];
  }
  for (const ws of wss.clients) if (ws.homeId === home.id) {
    ws.role = roleFor(home, ws.profile);
    send(ws, 'role', { role: ws.role, public: home.public });
    if (!ws.role) { ws.homeId = null; send(ws, 'error', { message: 'This home is now private. Head back to your own little place.' }); }
  }
  presence(home.id);
  persist();
  res.json({ ok: true });
});
app.post('/api/homes/:id/invite', (req, res) => {
  const home = db.homes[req.params.id];
  if (!home || home.owner !== req.profile.id) return res.status(403).json({ error: 'Only the homeowner can make invitations.' });
  const code = token();
  home.invites[code] = { role: ['viewer', 'decorator', 'builder'].includes(req.body.role) ? req.body.role : 'viewer', expires: Date.now() + 7 * 86400000 };
  persist();
  res.json({ code });
});
wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return ws.close(1008, 'Unrecognized origin');
  ws.profile = findProfile(new URL(req.url, 'http://localhost').searchParams.get('token'));
  if (!ws.profile) return ws.close(1008, 'Please sign in');
  ws.connectionId = randomUUID();
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString());
      if(msg.type==='street'){
        const previous=ws.homeId;ws.homeId=null;ws.street=true;
        ws.streetPosition={x:safeProfile(ws.profile).lotIndex*360+180,y:580};
        if(previous)presence(previous);streetPresence();return;
      }
      if(msg.type==='streetmove'&&ws.street){
        if(Number.isFinite(msg.x)&&Number.isFinite(msg.y)&&msg.x>=40&&msg.x<=Math.max(6,Object.keys(db.homes).length+2)*360-40&&msg.y>=530&&msg.y<=650){
          ws.streetPosition={x:msg.x,y:msg.y};
          for(const other of wss.clients)if(other.street&&other!==ws)send(other,'streetmove',{connectionId:ws.connectionId,position:ws.streetPosition});
        }return;
      }
      if (msg.type === 'join') {
        const home = db.homes[msg.homeId];
        if (!home) return send(ws, 'error', { message: 'This home could not be found.' });
        const invite = home.invites[msg.invite];
        if (invite && invite.expires > Date.now() && home.owner !== ws.profile.id) { home.permissions[ws.profile.id] = invite.role; persist(); }
        const role = roleFor(home, ws.profile);
        if (!role) return send(ws, 'error', { message: 'This little home is private. Ask the owner for an invitation.' });
        const previous = ws.homeId;
        const wasStreet=ws.street;ws.street=false;
        ws.homeId = home.id; ws.role = role; ws.position = homeSpawn(home.state);
        if(wasStreet)streetPresence();
        if (previous) presence(previous);
        send(ws, 'home', { homeId: home.id, state: home.state, version: home.version, role, public: home.public });
        presence(home.id);
      }
      const home = db.homes[ws.homeId];
      if (!home) return;
      if (msg.type === 'update') {
        ws.role = roleFor(home, ws.profile);
        if (!['owner', 'builder', 'decorator'].includes(ws.role)) return send(ws, 'error', { message: 'You have a visitor pass. Ask the owner for decorating permission.' });
        if (msg.version !== home.version) return send(ws, 'conflict', { state: home.state, version: home.version });
        if (!validateHome(msg.state)) return send(ws, 'error', { message: 'That change could not be saved. Try a smaller image or fewer objects.' });
        if (ws.role === 'decorator') {
          for (const key of ['boundary', 'sections', 'removedJoins', 'walls', 'openings', 'wallColor', 'floor', 'name']) if (JSON.stringify(msg.state[key]) !== JSON.stringify(home.state[key])) return send(ws, 'error', { message: 'Only builders can change the floor plan.' });
        }
        home.state = normalizePlan(msg.state); home.version++;
        persist();
        broadcast(home.id, 'updated', { state: home.state, version: home.version, by: ws.profile.name, clientId: msg.clientId });
      }
      if (msg.type === 'move' && Number.isFinite(msg.x) && Number.isFinite(msg.y) && canMove({ x: msg.x, y: msg.y }, home.state)) {
        ws.position = { x: msg.x, y: msg.y };
        broadcast(home.id, 'move', { connectionId: ws.connectionId, position: ws.position }, ws);
      }
      if (msg.type === 'chat' && typeof msg.text === 'string' && Date.now() - (ws.lastChat || 0) > 500) {
        ws.lastChat = Date.now();
        broadcast(home.id, 'chat', { id: randomUUID(), name: ws.profile.name, text: msg.text.trim().slice(0, 240), color: ws.profile.color });
      }
    } catch { send(ws, 'error', { message: 'A little hiccup. Please try that again.' }); }
  });
  ws.on('close', () => {presence(ws.homeId);if(ws.street)streetPresence();});
  ws.on('error', () => {});
});
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 30000).unref();
if (process.argv.includes('--production')) {
  app.use(express.static('dist'));
  app.get('/{*path}', (_, res) => res.sendFile(new URL('./dist/index.html', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => console.log(`Home, Made is ready at http://localhost:${port}`));
async function shutdown() {
  clearTimeout(saveTimer);
  await writeQueue;
  await writeFile(new URL('world.json', dataDir), JSON.stringify(db));
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
