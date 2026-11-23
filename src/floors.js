import {distanceToSegment,floorOutlines,pointInPolygon,homeSpawn,canMove} from './model.js';

export const ringContains=(ring,p)=>pointInPolygon(p,ring)||ring.some((a,i)=>distanceToSegment(p,a,ring[(i+1)%ring.length])<.2);
export function floorDescriptors(home){
  return floorOutlines(home).map((ring,i)=>{
    const x=Math.min(...ring.map(p=>p.x)),y=Math.min(...ring.map(p=>p.y));
    return {level:home.floorLevels?.[i]??i+1,ring,x,y,width:Math.max(...ring.map(p=>p.x))-x,height:Math.max(...ring.map(p=>p.y))-y};
  }).sort((a,b)=>a.level-b.level);
}
export function floorAtPoint(home,point){return floorDescriptors(home).find(f=>ringContains(f.ring,point));}
export function floorHome(home,floor){
  if(!floor)return {...home,boundary:[],outlines:[],holes:[],sections:[],walls:[],items:[],openings:[],stairs:[],floorLevels:[]};
  const owns=p=>p.level!=null?p.level===floor.level:ringContains(floor.ring,p);
  return {...home,level:floor.level,boundary:floor.ring,outlines:[floor.ring],floorLevels:[floor.level],
    sections:(home.sections||[]).filter(s=>s.level===floor.level||s.level==null&&s.points.some(p=>ringContains(floor.ring,p))),
    holes:(home.holes||[]).filter(r=>r.some(p=>ringContains(floor.ring,p))),
    walls:home.walls.filter(w=>w.points.some((b,i)=>i>0&&ringContains(floor.ring,{x:(b.x+w.points[i-1].x)/2,y:(b.y+w.points[i-1].y)/2}))),
    openings:home.openings.filter(owns),items:home.items.filter(owns),stairs:(home.stairs||[]).filter(owns)};
}
export function stackLayers(home,level){
  const floors=floorDescriptors(home),active=floors.find(f=>f.level===level)||floors[0];
  if(!active)return {floors,active:null,adjacent:null,offset:{x:0,y:0},adjacentOffset:{x:0,y:0}};
  const at=floors.indexOf(active),adjacent=at>0?floors[at-1]:floors[at+1]||null,base=floors[0];
  return {floors,active,adjacent,offset:{x:base.x-active.x,y:base.y-active.y},adjacentOffset:adjacent?{x:active.x-adjacent.x,y:active.y-adjacent.y}:{x:0,y:0}};
}
export function stairTravel(home,level,point){
  const layers=stackLayers(home,level),{active,floors}=layers;if(!active)return null;
  const at=floors.indexOf(active),above=floors[at+1],below=floors[at-1];
  const exits=floorHome(home,active).stairs.map(s=>({stair:s,x:s.x,y:s.y,target:floors.find(f=>f.level===s.toLevel)||above}));
  if(below)for(const s of floorHome(home,below).stairs){if(s.toLevel&&s.toLevel!==active.level)continue;exits.push({stair:s,x:s.x+active.x-below.x,y:s.y+active.y-below.y,target:below});}
  const exit=exits.find(s=>s.target&&Math.hypot(s.x-point.x,s.y-point.y)<85);if(!exit)return null;
  const target=floorHome(home,exit.target),arrival={x:point.x+exit.target.x-active.x,y:point.y+exit.target.y-active.y};
  return {level:exit.target.level,position:canMove(arrival,target)?arrival:homeSpawn(target)};
}
