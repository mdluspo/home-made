import clipping from 'polygon-clipping';
import {floorOutlines,pointInPolygon,PLAN_UNIT} from './model.js';

export const WOOD_FINISHES=[{id:'oak',name:'Honey oak',color:'#c8a577'},{id:'walnut',name:'Walnut',color:'#8c6952'},{id:'birch',name:'Pale birch',color:'#e3cfaa'},{id:'whitewash',name:'Whitewash',color:'#e5e2d4'}];
export const FABRIC_FINISHES=[{id:'sage',name:'Sage',color:'#a7b58c'},{id:'cream',name:'Linen',color:'#e9dfc7'},{id:'clay',name:'Terracotta',color:'#c58f77'},{id:'blue',name:'Dusty blue',color:'#96afb9'},{id:'rose',name:'Blush',color:'#c5a0a5'},{id:'charcoal',name:'Charcoal',color:'#737c73'}];
export const ROOM_STYLES=[
  {id:'cottage',name:'Cozy cottage',note:'Honey wood, sage & warm cream',floor:'oak',wallColor:'#e7e5cf',wood:'oak',fabric:'sage'},
  {id:'minimal',name:'Warm minimalist',note:'Pale birch, linen & soft stone',floor:'birch',wallColor:'#e5e3d9',wood:'birch',fabric:'cream'},
  {id:'vintage',name:'Vintage afternoon',note:'Walnut, blush & rosewood',floor:'rose',wallColor:'#e8d6c9',wood:'walnut',fabric:'rose'},
  {id:'coastal',name:'Quiet coast',note:'Whitewashed wood & dusty blue',floor:'birch',wallColor:'#d7dfdc',wood:'whitewash',fabric:'blue'},
];
export const floorColor=floor=>({oak:'#d8b98c',birch:'#e9d5ae',tile:'#bdc9ad',rose:'#c3a092'}[floor]||'#d8b98c');
export const polygonPath=geometry=>geometry.flatMap(poly=>poly.map(ring=>'M'+ring.map(p=>p.join(',')).join(' L')+' Z')).join(' ');
export const inRoom=(room,p)=>pointInPolygon(p,room.geometry[0].map(([x,y])=>({x,y})))&&!room.geometry.slice(1).some(r=>pointInPolygon(p,r.map(([x,y])=>({x,y}))));
export const roomSetting=(home,room,level=home.level)=>home.roomDecor?.find(r=>r.level===level&&inRoom(room,r));
export function designRooms(home){
  if(!home.boundary?.length)return [];
  let geometry=floorOutlines(home).map(r=>[r.map(p=>[p.x,p.y])]);
  const cuts=(home.holes||[]).map(r=>[r.map(p=>[p.x,p.y])]);
  for(const wall of home.walls)wall.points.slice(1).forEach((b,i)=>{
    const a=wall.points[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(length<.01)return;
    const half=Math.max(3,wall.thickness||7)/2,ux=(b.x-a.x)/length*half,uy=(b.y-a.y)/length*half;
    cuts.push([[[a.x-ux-uy,a.y-uy+ux],[b.x+ux-uy,b.y+uy+ux],[b.x+ux+uy,b.y+uy-ux],[a.x-ux+uy,a.y-uy-ux]]]);
  });
  if(cuts.length)geometry=clipping.difference(geometry,...cuts);
  return geometry.flatMap(poly=>{
    const ring=poly[0],ringArea=r=>Math.abs(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
    const area=ringArea(ring)-poly.slice(1).reduce((sum,hole)=>sum+ringArea(hole),0);
    if(area<100)return [];
    let cross=0,x=0,y=0;
    ring.forEach((p,i)=>{const q=ring[(i+1)%ring.length],c=p[0]*q[1]-q[0]*p[1];cross+=c;x+=(p[0]+q[0])*c;y+=(p[1]+q[1])*c;});
    const room={geometry:poly,area:area/PLAN_UNIT**2,x:x/(3*cross),y:y/(3*cross)};
    if(!inRoom(room,room)){
      const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top;
      let best=null,distance=Infinity;
      for(let iy=0;iy<24;iy++)for(let ix=0;ix<24;ix++){const p={x:left+w*(ix+.5)/24,y:top+h*(iy+.5)/24},d=Math.hypot(p.x-room.x,p.y-room.y);if(d<distance&&inRoom(room,p)){best=p;distance=d;}}
      if(!best)return [];Object.assign(room,best);
    }
    return [room];
  }).sort((a,b)=>a.y-b.y||a.x-b.x);
}
export function setRoomDecor(home,room,level,values){
  const existing=roomSetting(home,room,level);
  if(!existing&&(home.roomDecor?.length||0)>=300)return home;
  const record={...(existing||{id:globalThis.crypto.randomUUID(),level,x:room.x,y:room.y,name:'',showLabel:true}),...values};
  return {...home,roomDecor:existing?home.roomDecor.map(r=>r.id===existing.id?record:r):[...(home.roomDecor||[]),record]};
}
export function applyRoomStyle(home,styleId,level,room=null){
  const style=ROOM_STYLES.find(s=>s.id===styleId);if(!style)return home;
  let next=room?setRoomDecor(home,room,level,{style:style.id}):{...home,levelDecor:{...home.levelDecor,[level]:{style:style.id,floor:style.floor,wallColor:style.wallColor}}};
  if(next===home)return home;
  // A level preset replaces local palettes, but keeps room names and labels.
  if(!room&&home.roomDecor)next.roomDecor=home.roomDecor.map(r=>{
    if(r.level!==level||!r.style)return r;
    const {style:previousStyle,...record}=r;return record;
  });
  const onLevel=i=>i.level===level||i.level==null&&floorOutlines(home).some((ring,index)=>(home.floorLevels?.[index]??index+1)===level&&pointInPolygon(i,ring));
  return {...next,items:home.items.map(i=>onLevel(i)&&(!room||inRoom(room,i))&&!i.locked&&!home.custom.some(c=>c.id===i.type)?{...i,finish:{wood:style.wood,fabric:style.fabric}}:i)};
}
export function ambienceAt(hour=14){
  const h=((hour%24)+24)%24;
  if(h<6||h>=21)return {name:'Night',darkness:.5,color:'#24384e',warmth:0};
  if(h<9)return {name:'Morning',darkness:(9-h)/3*.18,color:'#b28a69',warmth:.08};
  if(h<17)return {name:'Daylight',darkness:0,color:'#fff2cd',warmth:0};
  return {name:'Golden evening',darkness:.12+(h-17)/4*.3,color:'#705970',warmth:.14};
}

// Choose paint by the source-plan room on the visible side of each wall face.
// Map back through the decorated run before checking room ownership: the
// cutaway corner projection must not move a room's paint onto another room.
export function roomWallPaint(home,mesh,rooms){
  const groups=new Map(),edges=mesh.projectedEdges||mesh.edges;
  for(const surface of mesh.surfaces){
    if(surface.kind!=='face'||surface.rimReturn)continue;
    const vertices=surface.geometry.flat(2);if(!vertices.length)continue;
    const x=vertices.reduce((s,p)=>s+p[0],0)/vertices.length,y=vertices.reduce((s,p)=>s+p[1],0)/vertices.length;
    const ground={x,y:surface.plane[0]*x+surface.plane[1]*y+surface.plane[2]};
    let nearest=null,best=Infinity;
    for(const edge of edges){
      const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((ground.x-edge.a.x)*dx+(ground.y-edge.a.y)*dy)/l));
      const d=Math.hypot(ground.x-edge.a.x-t*dx,ground.y-edge.a.y-t*dy);
      if(d<best){nearest={edge,t};best=d;}
    }
    if(!nearest)continue;
    const {edge,t}=nearest,a=edge.planA||edge.a,b=edge.planB||edge.b,dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy),side=dx<0?-1:1,offset=edge.thickness/2+2;
    const sample={x:a.x+t*dx-dy/l*side*offset,y:a.y+t*dy+dx/l*side*offset};
    const room=rooms.find(r=>inRoom(r,sample)),setting=room&&roomSetting(home,room),style=ROOM_STYLES.find(s=>s.id===setting?.style);
    if(!style)continue;
    if(!groups.has(style.wallColor))groups.set(style.wallColor,[]);
    groups.get(style.wallColor).push(surface.geometry);
  }
  return [...groups].map(([color,parts])=>({color,geometry:clipping.union(...parts)}));
}

const hex=c=>c.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));
export function materialColor(original,target){
  const rgb=hex(original),base=hex(target),light=(rgb[0]*.3+rgb[1]*.59+rgb[2]*.11)/255,delta=(light-.67)*.8;
  return '#'+base.map(v=>Math.round(delta>0?v+(255-v)*delta:v*(1+delta)).toString(16).padStart(2,'0')).join('');
}
export function validateDesign(home){
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),color=v=>typeof v==='string'&&/^#[a-f\d]{6}$/i.test(v),level=v=>Number.isSafeInteger(Number(v))&&Number(v)>0&&Number(v)<10000;
  if(home.levelDecor!==undefined&&(!obj(home.levelDecor)||Object.keys(home.levelDecor).length>50||Object.entries(home.levelDecor).some(([n,v])=>!level(n)||!obj(v)||!['oak','birch','tile','rose'].includes(v.floor)||!color(v.wallColor)||(v.style!==undefined&&!ROOM_STYLES.some(s=>s.id===v.style)))))return false;
  if(home.roomDecor!==undefined&&(!Array.isArray(home.roomDecor)||home.roomDecor.length>300||home.roomDecor.some(r=>!obj(r)||typeof r.id!=='string'||r.id.length>300||!level(r.level)||![r.x,r.y].every(n=>Number.isFinite(n)&&Math.abs(n)<10000)||typeof r.name!=='string'||r.name.length>48||typeof r.showLabel!=='boolean'||(r.style!==undefined&&!ROOM_STYLES.some(s=>s.id===r.style)))))return false;
  if(home.ambience!==undefined&&(!obj(home.ambience)||!Number.isFinite(home.ambience.hour)||home.ambience.hour<0||home.ambience.hour>24||typeof home.ambience.lights!=='boolean'))return false;
  return home.items.every(i=>(i.lit===undefined||typeof i.lit==='boolean')&&(i.finish===undefined||obj(i.finish)&&(i.finish.wood===undefined||WOOD_FINISHES.some(f=>f.id===i.finish.wood))&&(i.finish.fabric===undefined||FABRIC_FINISHES.some(f=>f.id===i.finish.fabric))));
}
