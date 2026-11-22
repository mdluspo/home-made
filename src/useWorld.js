import { useCallback, useEffect, useRef, useState } from 'react';
import { initialHome, migrateHome, normalizePlan } from './model.js';
import { recordHistory, travelHistory } from './history.js';

export function useWorld(notify) {
  const [home, setHome] = useState(initialHome);
  const [profile, setProfile] = useState(null);
  const [homeId, setHomeId] = useState(null);
  const [role, setRole] = useState(null);
  const [isPublic, setPublic] = useState(true);
  const [players, setPlayers] = useState([]);
  const [streetPlayers,setStreetPlayers]=useState([]);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Connecting');
  const [history, setHistory] = useState({ past: [], future: [] });
  const socket = useRef(null), token = useRef(''), version = useRef(0), currentHome = useRef(home), historyRef = useRef(history);
  const pending = useRef(null), inFlight = useRef(null), targetHome = useRef(null), profileRef = useRef(null), notifyRef = useRef(notify);
  notifyRef.current = notify;
  const clientId = useRef(crypto.randomUUID());
  const isReady = useRef(false);
  const joinedHome=useRef(null);
  const updateHistory = h => { historyRef.current = h; setHistory(h); };
  const applyHome = state => { currentHome.current = state; setHome(state); };
  const flush = () => {
    if (pending.current && !inFlight.current && socket.current?.readyState === WebSocket.OPEN && isReady.current) {
      const next = pending.current;
      pending.current = null;
      inFlight.current = next;
      socket.current.send(JSON.stringify({ type: 'update', version: version.current, state: next, clientId: clientId.current }));
      setStatus('Saving');
    }
  };
  const api = useCallback(async (path, options = {}) => {
    const response = await fetch('/api' + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}`, ...options.headers },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false, reconnectTimer, activeSocket, attempts = 0;
    const connect = async () => {
      try {
        let savedToken = '';
        try { savedToken = localStorage.getItem('homemade-token') || ''; } catch { /* private browser */ }
        const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: savedToken }) });
        if (!response.ok) throw new Error('The neighborhood is taking a little nap. Reconnecting…');
        const data = await response.json();
        if (cancelled) return;
        token.current = data.token;
        try { localStorage.setItem('homemade-token', data.token); } catch { notifyRef.current('Allow browser storage to remember your home on this device.'); }
        setProfile(data.profile); profileRef.current = data.profile;
        const params = new URLSearchParams(location.search);
        targetHome.current ||= { id: params.get('home') || data.profile.homeId, invite: params.get('invite') || '' };
        const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/live?token=${data.token}`);
        activeSocket = ws; socket.current = ws;
        ws.onopen = () => {
          attempts = 0; isReady.current = false;
          ws.send(JSON.stringify({ type: 'join', homeId: targetHome.current.id, invite: targetHome.current.invite }));
        };
        ws.onmessage = e => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'home') {
            const recovering = pending.current || inFlight.current;
            const received=normalizePlan(migrateHome(msg.state));
            if(joinedHome.current!==msg.homeId||(!recovering&&JSON.stringify(received)!==JSON.stringify(currentHome.current)))updateHistory({past:[],future:[]});
            joinedHome.current=msg.homeId;
            version.current = msg.version; inFlight.current = null;
            applyHome(received); setHomeId(msg.homeId); setRole(msg.role); setPublic(msg.public); setStatus('Saved');
            setMessages([]); isReady.current = true;
            if (recovering) { pending.current = recovering; applyHome(recovering); flush(); }
          }
          if (msg.type === 'updated') {
            version.current = msg.version;
            if (msg.clientId === clientId.current) {
              inFlight.current = null;
              if (!pending.current) { applyHome(msg.state); setStatus('Saved'); }
              flush();
            } else {
              applyHome(msg.state); setStatus('Saved');
              if (pending.current || inFlight.current) { pending.current = null; inFlight.current = null; notifyRef.current('Your friend made a change at the same moment. Their latest room is now synced.'); }
              updateHistory({ past: [], future: [] });
            }
          }
          if (msg.type === 'conflict') {
            version.current = msg.version; pending.current = null; inFlight.current = null;
            applyHome(msg.state); setStatus('Saved'); updateHistory({ past: [], future: [] });
            notifyRef.current('The room changed while you were editing. You’re all caught up — try that change again.');
          }
          if (msg.type === 'presence') setPlayers(msg.players);
          if(msg.type==='streetpresence')setStreetPlayers(msg.players);
          if(msg.type==='streetmove')setStreetPlayers(ps=>ps.map(p=>p.connectionId===msg.connectionId?{...p,position:msg.position}:p));
          if (msg.type === 'move') setPlayers(p => p.map(player => player.connectionId === msg.connectionId ? { ...player, position: msg.position } : player));
          if (msg.type === 'chat') setMessages(m => [...m.slice(-49), msg]);
          if (msg.type === 'role') { setRole(msg.role); setPublic(msg.public); }
          if (msg.type === 'error') {
            pending.current = null; inFlight.current = null; setStatus('Not saved');
            notifyRef.current(msg.message);
            if (!isReady.current && targetHome.current.id !== data.profile.homeId) {
              targetHome.current = { id: data.profile.homeId };
              ws.send(JSON.stringify({ type: 'join', homeId: data.profile.homeId }));
            }
          }
        };
        ws.onclose = () => {
          isReady.current = false;
          if (!cancelled) { setStatus('Reconnecting'); reconnectTimer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10000)); }
        };
        ws.onerror = () => ws.close();
      } catch (e) {
        if (!cancelled) { setStatus('Reconnecting'); reconnectTimer = setTimeout(connect, Math.min(1500 * 2 ** attempts++, 10000)); }
      }
    };
    connect();
    const warn = e => { if (pending.current || inFlight.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { cancelled = true; clearTimeout(reconnectTimer); activeSocket?.close(); window.removeEventListener('beforeunload', warn); };
  }, []);

  const commit = useCallback(updater => {
    const old = currentHome.current;
    const changed = typeof updater === 'function' ? updater(old) : updater;
    const structural = changed.boundary !== old.boundary || changed.walls !== old.walls || changed.sections !== old.sections || changed.openings !== old.openings;
    const next = structural ? normalizePlan(changed) : changed;
    if (JSON.stringify(old) === JSON.stringify(next)) return;
    updateHistory(recordHistory(historyRef.current,old));
    applyHome(next); pending.current = next; setStatus('Saving'); flush();
  }, []);
  const undo = useCallback(() => {
    const entry=travelHistory(historyRef.current,currentHome.current,'undo');
    if(!entry)return;
    const next=entry.state;updateHistory(entry.history);
    applyHome(next); pending.current = next; flush();
  }, []);
  const redo = useCallback(() => {
    const entry=travelHistory(historyRef.current,currentHome.current,'redo');
    if(!entry)return;
    const next=entry.state;updateHistory(entry.history);
    applyHome(next); pending.current = next; flush();
  }, []);
  const send = useCallback(payload => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(payload));
  }, []);
  const visit = useCallback(id => {
    if (pending.current || inFlight.current) { notifyRef.current('Give your home a moment to finish saving.'); return false; }
    if (!isReady.current || socket.current?.readyState !== WebSocket.OPEN) { notifyRef.current('Waiting to reconnect to the neighborhood.'); return false; }
    targetHome.current = { id }; isReady.current = false;
    send({ type: 'join', homeId: id });
    const url = new URL(location.href); url.search = id === profileRef.current?.homeId ? '' : `?home=${id}`;
    window.history.replaceState({}, '', url);
    return true;
  }, [send]);
  const updateProfile = async details => {
    const result = await api('/profile', { method: 'PATCH', body: details });
    setProfile(result); profileRef.current = result; return result;
  };
  const enterStreet=useCallback(()=>{send({type:'street'});},[send]);
  return { home, homeId, profile, role, isPublic, players, streetPlayers, messages, status, history, commit, undo, redo, send, api, visit, enterStreet, updateProfile };
}
