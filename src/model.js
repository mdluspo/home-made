import polygonClipping from 'polygon-clipping';

export const CATALOG = [
  { type: 'sofa', name: 'Sunday sofa', category: 'Furniture', color: '#a9b68c', tag: 'A soft place to land', w: 180, h: 140 },
  { type: 'chair', name: 'Reading chair', category: 'Furniture', color: '#d6a374', tag: 'Just one more chapter', w: 95, h: 110 },
  { type: 'table', name: 'Little oak table', category: 'Furniture', color: '#c39b70', tag: 'Made for slow mornings', w: 140, h: 100 },
  { type: 'shelf', name: 'Story keeper', category: 'Furniture', color: '#bc966f', tag: 'Room for your favorites', w: 125, h: 190 },
  { type: 'bed', name: 'Cloud bed', category: 'Bedroom', color: '#d5b484', tag: 'Five more minutes', w: 180, h: 160 },
  { type: 'cabinet', name: 'Oak sideboard', category: 'Furniture', color: '#b99168', tag: 'Hide away little things', w: 150, h: 110 },
  { type: 'plant', name: 'Happy monstera', category: 'Plants', color: '#85955e', tag: 'A little growing company', w: 85, h: 135 },
  { type: 'fern', name: 'Fern friend', category: 'Plants', color: '#8fa375', tag: 'Loves a sunny corner', w: 80, h: 100 },
  { type: 'lamp', name: 'Warm glow lamp', category: 'Lighting', color: '#e5c38a', tag: 'Let there be cozy', w: 80, h: 165 },
  { type: 'rug', name: 'Meadow rug', category: 'Decor', color: '#b6bd8e', tag: 'A little softer underfoot', w: 260, h: 140 },
  { type: 'art', name: 'A sunny little day', category: 'Decor', color: '#c5a06d', tag: 'A window to somewhere', w: 90, h: 90 },
  { type: 'books', name: 'Well-loved books', category: 'Decor', color: '#a3a6a0', tag: 'Stories to get lost in', w: 65, h: 55 },
  { type: 'kettle', name: 'Tea for two', category: 'Kitchen', color: '#cbb285', tag: 'Put the kettle on', w: 85, h: 70 },
  { type: 'stove', name: 'Little cookstove', category: 'Kitchen', color: '#9ca9a3', tag: 'Something good is cooking', w: 125, h: 125 },
  { type: 'fridge', name: 'Retro fridge', category: 'Kitchen', color: '#9fac94', tag: 'Keep the good things fresh', w: 100, h: 175 },
  { type: 'nightstand', name: 'Bedside buddy', category: 'Bedroom', color: '#b99570', tag: 'Your book goes here', w: 85, h: 85 },
  { type: 'mirror', name: 'Morning mirror', category: 'Bedroom', color: '#b99570', tag: 'Hello, lovely', w: 80, h: 145 },
  { type: 'cat', name: 'Sleepy companion', category: 'Decor', color: '#d5b281', tag: 'Already feels at home', w: 85, h: 65 },
];
const FOOTPRINTS={sofa:[110,48],chair:[45,46],table:[64,52],shelf:[90,26],bed:[82,108],cabinet:[82,32],plant:[38,38],fern:[34,34],lamp:[26,26],rug:[140,95],art:[42,28],books:[25,19],kettle:[28,28],stove:[48,48],fridge:[45,48],nightstand:[36,32],mirror:[38,18],cat:[32,24]};
export const furnitureFootprint=type=>FOOTPRINTS[type]||[70,70];
const FURNITURE_RISE={sofa:20,chair:18,table:14,shelf:52,bed:14,cabinet:18,plant:22,fern:15,lamp:44,rug:0,art:14,books:4,kettle:12,stove:16,fridge:46,nightstand:14,mirror:44,cat:9};
export function furnitureVisualBounds(type){
  const [w,h]=furnitureFootprint(type),rise=FURNITURE_RISE[type]||0,extra=type==='lamp'?7:4;
  return {x:-w/2-extra,y:-h/2-rise-3,width:w+extra*2,height:h+rise+11};
}
export const makeId = () => globalThis.crypto.randomUUID();
export function initialHome() {
  return {
    name: 'My house', description: 'An empty space, ready to become your home.',
    geometryVersion: 2, floor: 'oak', wallColor: '#e7e5cf', grid: true,
    boundary: [], sections: [], outlines: [], holes: [], walls: [], openings: [], custom: [],
    items: [],
  };
}
// All geometry lives in a top-down plan. 50 drawing units = 1 metre.
// Decoration and exploration project this same plan into the illustrated room.
export const PLAN_UNIT = 50;
export const DEFAULT_BOUNDARY = [];
export const planToWorld = p => ({ x: 540 + (p.x - 540) * .78 - (p.y - 385) * .78, y: 445 + (p.x - 540) * .4 + (p.y - 385) * .4 });
export const worldToPlan = p => ({ x: 540 + ((p.x - 540) / .78 + (p.y - 445) / .4) / 2, y: 385 + ((p.y - 445) / .4 - (p.x - 540) / .78) / 2 });
export function migrateHome(home) {
  if (home.geometryVersion === 2) return home.name === 'My little sanctuary' || home.name === 'Little sanctuary' ? { ...home, name: 'My house' } : home;
  const originalItems = home.items.filter(i => !i.id.endsWith('-initial'));
  return { ...home, name: home.name === 'My little sanctuary' || home.name === 'Little sanctuary' ? 'My house' : home.name, geometryVersion: 2,
    items: originalItems.map(i => ({ ...i, ...worldToPlan(i) })),
    boundary: home.boundary.map(worldToPlan),
    walls: home.walls.map(w => ({ ...w, points: w.points.map(worldToPlan) })),
    openings: home.openings.map(o => ({ ...o, ...worldToPlan(o) })),
  };
}
export function planArea(points) {
  return Math.abs(points.reduce((sum, p, i) => { const n = points[(i + 1) % points.length]; return sum + p.x * n.y - n.x * p.y; }, 0)) / 2 / PLAN_UNIT ** 2;
}
export function rectangleFromPoints(a, b) {
  return [{ x: Math.min(a.x,b.x), y: Math.min(a.y,b.y) },{ x: Math.max(a.x,b.x), y: Math.min(a.y,b.y) },{ x: Math.max(a.x,b.x), y: Math.max(a.y,b.y) },{ x: Math.min(a.x,b.x), y: Math.max(a.y,b.y) }];
}
export function getSections(home){
  if(Array.isArray(home.sections)&&home.sections.length)return home.sections;
  return home.boundary.length>2?[{id:'original-floor',type:home.outlineType||'custom',points:home.boundary}]:[];
}
export function floorOutlines(home){
  return home.outlines?.length?home.outlines:home.boundary.length>2?[home.boundary]:[];
}
export function pointInHome(point,home){
  return floorOutlines(home).some(r=>pointInPolygon(point,r))&&!(home.holes||[]).some(r=>pointInPolygon(point,r));
}
const polygonOf=points=>[points.map(p=>[p.x,p.y])];
const ringsOf=geometry=>geometry.flatMap(poly=>poly.map(r=>r.slice(0,-1).map(([x,y])=>({x,y}))));
const inGeometry=(p,geometry)=>geometry.some(poly=>pointInPolygon(p,poly[0].map(([x,y])=>({x,y})))&&!poly.slice(1).some(r=>pointInPolygon(p,r.map(([x,y])=>({x,y})))));
function unionSections(sections){
  if(!sections.length)return [];
  return polygonClipping.union(...sections.map(s=>polygonOf(s.points)));
}
export function snapSection(section,others,tolerance=18){
  let best=null;
  const consider=(dx,dy)=>{const distance=Math.hypot(dx,dy);if(distance<tolerance&&distance>.00001&&(!best||distance<best.distance))best={dx,dy,distance};};
  const project=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {x:a.x+t*dx,y:a.y+t*dy};};
  for(const other of others)for(let i=0;i<section.points.length;i++){
    const a=section.points[i],b=section.points[(i+1)%section.points.length];
    for(let j=0;j<other.points.length;j++){
      const c=other.points[j],d=other.points[(j+1)%other.points.length];
      if(distanceToSegment(a,c,d)<.0001||distanceToSegment(c,a,b)<.0001)return section;
      const p=project(a,c,d);consider(p.x-a.x,p.y-a.y);
      const q=project(c,a,b);consider(c.x-q.x,c.y-q.y);
    }
  }
  return best?{...section,points:section.points.map(p=>({x:p.x+best.dx,y:p.y+best.dy}))}:section;
}
export function addFloorSection(home,points,type='custom'){
  const sections=getSections(home);
  const section=snapSection({id:makeId(),type,points},sections);
  return {...home,sections:[...sections,section]};
}
function sectionLayout(home){
  const sections=getSections(home).filter(s=>s.points.length>2&&planArea(s.points)>.01);
  let geometry=[];const joins=[];
  for(let si=0;si<sections.length;si++){
    const current=sections[si],previous=geometry;
    geometry=previous.length?polygonClipping.union(previous,polygonOf(current.points)):polygonClipping.union(polygonOf(current.points));
    for(const ring of ringsOf(previous))for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.01)continue;
      const cuts=[0,1];
      current.points.forEach((c,j)=>{const d=current.points[(j+1)%current.points.length],hit=segmentCross(a,b,c,d);if(hit)cuts.push(hit.t);
        for(const p of [c,d])if(distanceToSegment(p,a,b)<.01){const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length);if(t>0&&t<1)cuts.push(t);}
      });
      const ts=[...new Set(cuts.map(t=>Math.round(t*1e7)/1e7))].sort((x,y)=>x-y);
      for(let j=1;j<ts.length;j++){
        const p=lerpPoint(a,b,ts[j-1]),q=lerpPoint(a,b,ts[j]),m=lerpPoint(p,q,.5),nx=dy/length*1.5,ny=-dx/length*1.5;
        if(Math.hypot(q.x-p.x,q.y-p.y)<1||!inGeometry({x:m.x+nx,y:m.y+ny},geometry)||!inGeometry({x:m.x-nx,y:m.y-ny},geometry))continue;
        const owner=sections.slice(0,si).find(s=>s.points.some((c,k)=>distanceToSegment(m,c,s.points[(k+1)%s.points.length])<.1));
        const joinKey=[owner?.id||'original-floor',current.id].sort().join('|');
        if(home.removedJoins?.includes(joinKey))continue;
        joins.push({id:`join:${joinKey}:${i}:${j}`,source:'join',joinKey,curved:false,points:[p,q]});
      }
    }
  }
  const outlines=geometry.map(poly=>poly[0].slice(0,-1).map(([x,y])=>({x,y}))).sort((a,b)=>planArea(b)-planArea(a));
  const holes=geometry.flatMap(poly=>poly.slice(1).map(r=>r.slice(0,-1).map(([x,y])=>({x,y}))));
  return {sections,outlines,holes,boundary:outlines[0]||[],joins};
}
const lerpPoint=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const closePoint=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<.05;
function segmentCross(a,b,c,d) {
  const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
  if(Math.abs(den)<1e-8)return null;
  const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
  return t>=-1e-7&&t<=1+1e-7&&u>=-1e-7&&u<=1+1e-7?{t:Math.max(0,Math.min(1,t)),u:Math.max(0,Math.min(1,u)),point:lerpPoint(a,b,t)}:null;
}
// Extend only beyond the drawn endpoints. A wall already crossed by the
// stroke cannot pull its end backwards into the previous room.
export function extendDivider(home,wall){
  if(wall.points.length<2)return wall;
  const rings=[...floorOutlines(home),...(home.holes||[])];
  const barriers=[...rings.map(r=>[...r,r[0]]),...home.walls.filter(w=>w.id!==wall.id).map(w=>w.points)];
  const all=rings.flat();
  if(!all.length)return wall;
  const reach=Math.hypot(Math.max(...all.map(p=>p.x))-Math.min(...all.map(p=>p.x)),Math.max(...all.map(p=>p.y))-Math.min(...all.map(p=>p.y)))*2+1;
  const extend=(end,neighbor)=>{
    if(!pointInHome(end,home)||barriers.some(ps=>ps.some((p,i)=>i>0&&distanceToSegment(end,ps[i-1],p)<.1)))return end;
    const length=Math.hypot(end.x-neighbor.x,end.y-neighbor.y);
    if(length<.001)return end;
    const far={x:end.x+(end.x-neighbor.x)/length*reach,y:end.y+(end.y-neighbor.y)/length*reach};
    let nearest=null;
    for(const ps of barriers)for(let i=1;i<ps.length;i++){
      const hit=segmentCross(end,far,ps[i-1],ps[i]);
      if(hit&&hit.t>1e-7&&(!nearest||hit.t<nearest.t))nearest=hit;
    }
    return nearest?.point||end;
  };
  const points=wall.points.map(p=>({...p}));
  const firstNeighbor=points.find(p=>!closePoint(p,points[0]));
  const lastNeighbor=[...points].reverse().find(p=>!closePoint(p,points.at(-1)));
  if(firstNeighbor)points[0]=extend(wall.points[0],firstNeighbor);
  if(lastNeighbor)points[points.length-1]=extend(wall.points.at(-1),lastNeighbor);
  return {...wall,points};
}
export function addDivider(home,wall){
  return normalizePlan({...home,walls:[...home.walls,extendDivider(home,wall)]});
}
function clipPolyline(points,boundary,holes=[]) {
  const pieces=[];let active=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const cuts=[0,1];
    for(const ring of [boundary,...holes])ring.forEach((c,j)=>{const hit=segmentCross(a,b,c,ring[(j+1)%ring.length]);if(hit)cuts.push(hit.t);});
    const sorted=[...new Set(cuts.map(t=>Math.round(t*1e8)/1e8))].sort((x,y)=>x-y);
    for(let j=1;j<sorted.length;j++){
      const t0=sorted[j-1],t1=sorted[j];
      if(t1-t0<1e-6)continue;
      const p=lerpPoint(a,b,t0),q=lerpPoint(a,b,t1);
      const midpoint=lerpPoint(a,b,(t0+t1)/2);
      if(pointInPolygon(midpoint,boundary)&&!holes.some(r=>pointInPolygon(midpoint,r))){
        if(active.length&&!closePoint(active.at(-1),p)){if(active.length>1)pieces.push(active);active=[];}
        if(!active.length)active.push(p);active.push(q);
      }else if(active.length){if(active.length>1)pieces.push(active);active=[];}
    }
  }
  if(active.length>1)pieces.push(active);
  return pieces;
}
function mergeCollinearWalls(source){
  const result=[...source];
  for(let i=0;i<result.length;i++){
    const wall=result[i];if(wall.curved||wall.points.length!==2)continue;
    let again=true;
    while(again){again=false;
      const [a,b]=wall.points,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.01)break;
      for(let j=i+1;j<result.length;j++){
        const other=result[j];if(other.curved||other.points.length!==2||other.source!==wall.source)continue;
        const [c,d]=other.points;
        if(Math.abs((c.x-a.x)*dy-(c.y-a.y)*dx)/length>.05||Math.abs((d.x-a.x)*dy-(d.y-a.y)*dx)/length>.05)continue;
        const t=p=>((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length),tc=t(c),td=t(d),lo=Math.min(tc,td),hi=Math.max(tc,td);
        if(lo>1+.05/length||hi<-.05/length)continue;
        if(Math.min(1,hi)-Math.max(0,lo)<.05/length){
          const join=lerpPoint(a,b,lo>=1-.05/length?1:0);
          if(result.some((third,k)=>k!==i&&k!==j&&third.points.some(p=>closePoint(p,join))&&third.points.some(p=>Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)/length>.05)))continue;
        }
        wall.points=[lerpPoint(a,b,Math.min(0,lo)),lerpPoint(a,b,Math.max(1,hi))];result.splice(j,1);again=true;break;
      }
    }
  }return result;
}
// Walls belong to the plan: trim exterior portions and turn crossings into
// shared endpoints. The same resulting geometry drives rooms and collisions.
export function normalizePlan(home) {
  const layout=sectionLayout(home),{joins,...shape}=layout;
  home={...home,...shape};
  if(!home.sections.length)return {...home,walls:[],openings:[]};
  const rings=[...home.outlines,...home.holes];
  const source=[...home.walls.filter(w=>w.source!=='join'),...joins];
  const clipped=mergeCollinearWalls(source.flatMap(w=>home.outlines.flatMap((outline,ri)=>clipPolyline(w.points,outline,home.holes).map((points,i)=>({...w,id:i||ri?`${w.id}~clip${ri}-${i}`:w.id,points})))).filter(w=>!w.points.slice(1).every((q,j)=>rings.some(ring=>ring.some((a,i)=>{const b=ring[(i+1)%ring.length];return distanceToSegment(w.points[j],a,b)<.05&&distanceToSegment(q,a,b)<.05;})))));
  const cuts=clipped.map(w=>w.points.slice(1).map(()=>[]));
  for(let i=0;i<clipped.length;i++)for(let j=i+1;j<clipped.length;j++){
    const a=clipped[i].points,b=clipped[j].points;
    for(let ai=1;ai<a.length;ai++)for(let bi=1;bi<b.length;bi++){
      const hit=segmentCross(a[ai-1],a[ai],b[bi-1],b[bi]);if(!hit)continue;
      if(hit.t>1e-6&&hit.t<1-1e-6)cuts[i][ai-1].push(hit.t);
      if(hit.u>1e-6&&hit.u<1-1e-6)cuts[j][bi-1].push(hit.u);
    }
  }
  const walls=[];
  clipped.forEach((wall,wi)=>{
    let active=[wall.points[0]],part=0;
    const push=()=>{if(active.length>1&&active.some(p=>!closePoint(p,active[0]))){walls.push({...wall,id:part?`${wall.id}~split${part}`:wall.id,points:active});part++;}};
    for(let i=1;i<wall.points.length;i++){
      const sorted=[...new Set(cuts[wi][i-1].map(t=>Math.round(t*1e8)/1e8))].sort((a,b)=>a-b);
      for(const t of sorted){const p=lerpPoint(wall.points[i-1],wall.points[i],t);active.push(p);push();active=[p];}
      active.push(wall.points[i]);
    }
    push();
  });
  const edges=[...walls.map(w=>w.points),...rings.map(r=>[...r,r[0]])];
  const alignedOpenings=home.openings.filter(o=>edges.some(ps=>ps.some((p,i)=>i>0&&distanceToSegment(o,ps[i-1],p)<14))).map(opening=>{
    if(edges.some(ps=>ps.some((p,i)=>i>0&&distanceToSegment(opening,ps[i-1],p)<.001)))return opening;
    let best=null;
    for(const points of edges)for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((opening.x-a.x)*dx+(opening.y-a.y)*dy)/(length*length||1))),q={x:a.x+t*dx,y:a.y+t*dy},distance=Math.hypot(q.x-opening.x,q.y-opening.y),angle=Math.atan2(dy,dx)*180/Math.PI;
      const aligned=Math.abs(Math.cos((angle-(opening.angle||0))*Math.PI/180))>.96,score=distance+(distance<14&&!aligned?14:0);
      if(!best||score<best.score)best={a,b,t,length,angle,score};
    }
    if(!best)return opening;
    const clearance=Math.min(21/Math.max(best.length,21),.5),t=Math.max(clearance,Math.min(1-clearance,best.t));
    let angle=best.angle;if(Math.cos((angle-(opening.angle||0))*Math.PI/180)<0)angle+=angle>0?-180:180;
    return {...opening,x:best.a.x+t*(best.b.x-best.a.x),y:best.a.y+t*(best.b.y-best.a.y),angle};
  });
  const openings=[];
  for(const opening of alignedOpenings){
    if(opening.type==='door'){
      const nearby= openings.filter(o=>o.type==='door'&&Math.abs(Math.sin(((o.angle||0)-(opening.angle||0))*Math.PI/180))<.12&&Math.hypot(o.x-opening.x,o.y-opening.y)<100);
      if(nearby.some(o=>Math.hypot(o.x-opening.x,o.y-opening.y)<18)||nearby.length>=2)continue;
    }
    openings.push(opening);
  }
  const paired=new Set();
  for(let i=0;i<openings.length;i++){
    const first=openings[i];if(first.type!=='door'||paired.has(i))continue;
    const secondIndex=openings.findIndex((o,j)=>j>i&&!paired.has(j)&&o.type==='door'&&Math.abs(Math.sin(((o.angle||0)-(first.angle||0))*Math.PI/180))<.12&&Math.hypot(o.x-first.x,o.y-first.y)<100);
    if(secondIndex<0)continue;
    const second=openings[secondIndex],angle=(first.angle||0)*Math.PI/180,cx=(first.x+second.x)/2,cy=(first.y+second.y)/2,ux=Math.cos(angle)*21,uy=Math.sin(angle)*21;
    const left={x:cx-ux,y:cy-uy},right={x:cx+ux,y:cy+uy};
    const fits=p=>edges.some(points=>points.some((a,k)=>k>0&&distanceToSegment(p,points[k-1],a)<.5));
    if(fits(left)&&fits(right)){first.x=left.x;first.y=left.y;second.x=right.x;second.y=right.y;}
    paired.add(i);paired.add(secondIndex);
  }
  return {...home,walls,openings};
}
export function homeSpawn(home) {
  if (!home.boundary.length) return { x:540,y:385 };
  const minX=Math.min(...home.boundary.map(p=>p.x)),maxX=Math.max(...home.boundary.map(p=>p.x));
  const minY=Math.min(...home.boundary.map(p=>p.y)),maxY=Math.max(...home.boundary.map(p=>p.y));
  const center={x:(minX+maxX)/2,y:(minY+maxY)/2};
  if(canMove(center,home))return center;
  for(let y=minY+20;y<maxY;y+=20)for(let x=minX+20;x<maxX;x+=20)if(canMove({x,y},home))return {x,y};
  return center;
}
export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function distanceToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function canMove(point, home) {
  if (!pointInHome(point, home)) return false;
  for (const wall of home.walls) {
    for (let i = 1; i < wall.points.length; i++) {
      if (distanceToSegment(point, wall.points[i - 1], wall.points[i]) < 9) {
        if (!home.openings.some(o => o.type === 'door' && o.open && Math.hypot(o.x - point.x, o.y - point.y) < 28)) return false;
      }
    }
  }
  return !home.items.some(item=>{
    if(!['sofa','chair','table','shelf','bed','cabinet','fridge','stove','nightstand'].includes(item.type))return false;
    const [w,h]=furnitureFootprint(item.type),angle=-(item.rotation||0)*Math.PI/180,dx=point.x-item.x,dy=point.y-item.y;
    return Math.abs(dx*Math.cos(angle)-dy*Math.sin(angle))<w*item.scale/2+5&&Math.abs(dx*Math.sin(angle)+dy*Math.cos(angle))<h*item.scale/2+5;
  });
}
export function smoothPath(points, closed = false) {
  if (!points.length) return '';
  if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    path += ` Q${points[i].x},${points[i].y} ${mid.x},${mid.y}`;
  }
  const last = points.at(-1);
  return `${path} L${last.x},${last.y}${closed ? ' Z' : ''}`;
}
export function cleanPoints(points, straight = false) {
  if (points.length < 2) return points;
  if (straight) return [points[0], points.at(-1)].map(p => ({ x:p.x, y:p.y }));
  const cleaned = [points[0]];
  for (const p of points.slice(1)) if (Math.hypot(p.x - cleaned.at(-1).x, p.y - cleaned.at(-1).y) > 7) cleaned.push(p);
  cleaned.push(points.at(-1));
  return cleaned;
}
export function validateHome(home) {
  if (!home || typeof home.name !== 'string' || home.name.length > 80) return false;
  if (!['oak', 'birch', 'tile', 'rose'].includes(home.floor) || !/^#[0-9a-f]{6}$/i.test(home.wallColor)) return false;
  if (!Array.isArray(home.items) || home.items.length > 300 || !Array.isArray(home.walls) || home.walls.length > 100) return false;
  const finite = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 10000;
  const point = p => p && finite(p.x) && finite(p.y);
  if (!Array.isArray(home.boundary) || home.boundary.length > 2000 || !home.boundary.every(point)) return false;
  if(home.sections!==undefined&&(!Array.isArray(home.sections)||home.sections.length>50||!home.sections.every(s=>typeof s.id==='string'&&Array.isArray(s.points)&&s.points.length>=3&&s.points.length<=2000&&s.points.every(point))))return false;
  if(home.removedJoins!==undefined&&(!Array.isArray(home.removedJoins)||home.removedJoins.length>500||!home.removedJoins.every(k=>typeof k==='string'&&k.length<300)))return false;
  if (!Array.isArray(home.openings) || home.openings.length > 200 || !home.openings.every(o => point(o) && ['door', 'window'].includes(o.type))) return false;
  if (!home.walls.every(w => typeof w.id === 'string' && Array.isArray(w.points) && w.points.length >= 2 && w.points.length <= 2000 && w.points.every(point))) return false;
  if (!Array.isArray(home.custom) || home.custom.length > 50 || !home.custom.every(c => typeof c.id === 'string' && typeof c.name === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(c.src) && c.src.length < 3000000)) return false;
  return home.items.every(i => typeof i.id === 'string' && (CATALOG.some(c => c.type === i.type) || home.custom.some(c => c.id === i.type)) && point(i) && finite(i.rotation) && finite(i.scale) && i.scale >= 0.2 && i.scale <= 3);
}
