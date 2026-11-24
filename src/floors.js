import clipping from 'polygon-clipping';
import {distanceToSegment,floorOutlines,getSections,pointInPolygon,homeSpawn,canMove} from './model.js';

export const ringContains=(ring,p)=>pointInPolygon(p,ring)||ring.some((a,i)=>distanceToSegment(p,a,ring[(i+1)%ring.length])<.2);
export function floorDescriptors(home){
  return floorOutlines(home).map((ring,i)=>{
    const x=Math.min(...ring.map(p=>p.x)),y=Math.min(...ring.map(p=>p.y));
    const level=home.floorLevels?.[i]??i+1;
    return {level,ring,x,y,width:Math.max(...ring.map(p=>p.x))-x,height:Math.max(...ring.map(p=>p.y))-y,origin:home.floorOrigins?.[level]||{x,y},offset:home.floorOffsets?.[level]||{x:0,y:0}};
  }).sort((a,b)=>a.level-b.level);
}
export function floorAtPoint(home,point){return floorDescriptors(home).find(f=>ringContains(f.ring,point));}
// An object's level is identity, not a visibility test against its moving centre.
// Recover legacy unassigned decorations just outside an edge on the nearest floor.
export function objectFloorLevel(home,object,floors=floorDescriptors(home)){
  if(object.level!=null&&floors.some(f=>f.level===object.level))return object.level;
  const inside=floors.find(f=>ringContains(f.ring,object));if(inside)return inside.level;
  let nearest=null,distance=Infinity;
  for(const floor of floors)for(let i=0;i<floor.ring.length;i++){
    const d=distanceToSegment(object,floor.ring[i],floor.ring[(i+1)%floor.ring.length]);
    if(d<distance){nearest=floor;distance=d;}
  }
  return nearest?.level;
}
const polygon=ring=>[ring.map(p=>[p.x,p.y])];
const polygonArea=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
function blueprintLinks(home,floors){
  const sections=getSections(home),saved=home.floorBlueprints||{},links={};
  const references=(home.blueprints||[]).flatMap(b=>{
    const section=sections.find(s=>s.id===b.sourceSectionId),source=section&&floors.find(f=>f.level===section.level);
    if(!source)return [];
    return [{...b,source,ring:source.ring.map(p=>({x:b.x+p.x-source.x,y:b.y+p.y-source.y}))}];
  });
  for(const floor of floors){
    const members=sections.filter(s=>s.level===floor.level),candidates=references.filter(b=>b.source.level<floor.level);
    const previous=candidates.find(b=>members.some(s=>saved[s.id]===b.id));
    const overlap=b=>{
      if(floor.x+floor.width<=b.x||floor.x>=b.x+b.source.width||floor.y+floor.height<=b.y||floor.y>=b.y+b.source.height)return 0;
      return clipping.intersection(polygon(floor.ring),polygon(b.ring)).reduce((sum,p)=>sum+polygonArea(p[0])-p.slice(1).reduce((area,r)=>area+polygonArea(r),0),0);
    };
    let best=previous,bestArea=previous?overlap(previous):0;
    for(const candidate of candidates){
      const area=overlap(candidate);
      if(area>1&&(area>bestArea+1||!previous&&Math.abs(area-bestArea)<=1&&candidate.source.level>(best?.source.level||0))){best=candidate;bestArea=area;}
    }
    // Keep a known reference through overhangs, including moves wholly outside
    // it. Only a better overlapping reference changes the association.
    if(best)for(const section of members)links[section.id]=best.id;
  }
  return links;
}
export function linkFloorBlueprints(home){
  const floors=floorDescriptors(home),links=blueprintLinks(home,floors),saved=home.floorBlueprints||{},sections=getSections(home);
  const registrations=floorRegistrations(home,floors,links),base=floors[0];
  let offsets=home.floorOffsets;
  for(const floor of floors){
    if(!sections.some(s=>s.level===floor.level&&links[s.id]))continue;
    const offset={x:registrations[floor.level].x-base.origin.x+floor.origin.x+base.offset.x,y:registrations[floor.level].y-base.origin.y+floor.origin.y+base.offset.y};
    const before=offsets?.[floor.level];
    if(!before||Math.abs(before.x-offset.x)>.00001||Math.abs(before.y-offset.y)>.00001)offsets={...offsets,[floor.level]:offset};
  }
  // Cache the last registration too, so deleting a reference guide does not
  // make an already positioned floor jump back to its original alignment.
  if(offsets===home.floorOffsets&&Object.keys(links).length===Object.keys(saved).length&&Object.entries(links).every(([id,value])=>saved[id]===value))return home;
  return {...home,floorBlueprints:links,...(offsets?{floorOffsets:offsets}:{})};
}
function floorRegistrations(home,floors,links=blueprintLinks(home,floors)){
  const sections=getSections(home),registrations={},base=floors[0];
  for(const floor of floors){
    const id=sections.filter(s=>s.level===floor.level).map(s=>links[s.id]).find(Boolean);
    const blueprint=(home.blueprints||[]).find(b=>b.id===id),sourceSection=blueprint&&sections.find(s=>s.id===blueprint.sourceSectionId);
    const source=sourceSection&&floors.find(f=>f.level===sourceSection.level);
    if(source&&registrations[source.level]){
      const origin=registrations[source.level];
      registrations[floor.level]={x:origin.x+source.x-blueprint.x,y:origin.y+source.y-blueprint.y};
    }else registrations[floor.level]={x:base.origin.x-floor.origin.x+floor.offset.x-base.offset.x,y:base.origin.y-floor.origin.y+floor.offset.y-base.offset.y};
  }
  return registrations;
}
export function previousFloorBlueprint(home,level,draft=null){
  const floors=floorDescriptors(home),active=floors.find(f=>f.level===level),lower=floors.filter(f=>f.level<level).at(-1);
  const target=active||(draft?{origin:home.floorOrigins?.[level]||draft,offset:home.floorOffsets?.[level]||{x:0,y:0}}:null);
  if(!target||!lower)return null;
  // The lower sheet supplies a shape, never its workspace position. Its
  // current bounds cancel out translations; the target owns the fixed anchor.
  const dx=target.origin.x-lower.x-target.offset.x,dy=target.origin.y-lower.y-target.offset.y;
  return {level:lower.level,ring:lower.ring.map(p=>({x:p.x+dx,y:p.y+dy}))};
}
export function floorHome(home,floor){
  if(!floor)return {...home,boundary:[],outlines:[],holes:[],sections:[],walls:[],items:[],openings:[],stairs:[],floorLevels:[]};
  const owns=p=>p.level!=null?p.level===floor.level:ringContains(floor.ring,p);
  const floors=floorDescriptors(home),ownsObject=p=>objectFloorLevel(home,p,floors)===floor.level;
  return {...home,level:floor.level,boundary:floor.ring,outlines:[floor.ring],floorLevels:[floor.level],
    sections:(home.sections||[]).filter(s=>s.level===floor.level||s.level==null&&s.points.some(p=>ringContains(floor.ring,p))),
    holes:(home.holes||[]).filter(r=>r.some(p=>ringContains(floor.ring,p))),
    walls:home.walls.filter(w=>w.points.some((b,i)=>i>0&&ringContains(floor.ring,{x:(b.x+w.points[i-1].x)/2,y:(b.y+w.points[i-1].y)/2}))),
    openings:home.openings.filter(owns),items:home.items.filter(ownsObject),stairs:(home.stairs||[]).filter(ownsObject)};
}
export function stackLayers(home,level){
  const floors=floorDescriptors(home),active=floors.find(f=>f.level===level)||floors[0];
  if(!active)return {floors,active:null,adjacent:null,offset:{x:0,y:0},adjacentOffset:{x:0,y:0},registrations:{}};
  const at=floors.indexOf(active),adjacent=at>0?floors[at-1]:floors[at+1]||null,registrations=floorRegistrations(home,floors),offset=registrations[active.level];
  return {floors,active,adjacent,registrations,offset,adjacentOffset:adjacent?{x:registrations[adjacent.level].x-offset.x,y:registrations[adjacent.level].y-offset.y}:{x:0,y:0}};
}
export function stairTravel(home,level,point){
  const layers=stackLayers(home,level),{active,floors}=layers;if(!active)return null;
  const at=floors.indexOf(active),above=floors[at+1],below=floors[at-1];
  const exits=floorHome(home,active).stairs.map(s=>({stair:s,x:s.x,y:s.y,target:floors.find(f=>f.level===s.toLevel)||above}));
  if(below)for(const s of floorHome(home,below).stairs){if(s.toLevel&&s.toLevel!==active.level)continue;exits.push({stair:s,x:s.x+layers.adjacentOffset.x,y:s.y+layers.adjacentOffset.y,target:below});}
  const exit=exits.find(s=>s.target&&Math.hypot(s.x-point.x,s.y-point.y)<85);if(!exit)return null;
  const target=floorHome(home,exit.target),registration=layers.registrations[exit.target.level],arrival={x:point.x+layers.offset.x-registration.x,y:point.y+layers.offset.y-registration.y};
  return {level:exit.target.level,position:canMove(arrival,target)?arrival:homeSpawn(target)};
}
