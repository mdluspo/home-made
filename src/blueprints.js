import {getSections,makeId} from './model.js';
import {floorDescriptors} from './floors.js';

const localOutline=floor=>floor.ring.map(p=>({x:p.x-floor.x,y:p.y-floor.y}));
export function blueprintSource(home,blueprint){
  const section=getSections(home).find(s=>s.id===blueprint.sourceSectionId);
  return section?floorDescriptors(home).find(f=>f.level===section.level):null;
}
export function blueprintGeometry(home,blueprint){
  const source=blueprintSource(home,blueprint),outline=source?localOutline(source):blueprint.outline;
  const ring=outline.map(p=>({x:p.x+blueprint.x,y:p.y+blueprint.y}));
  return {source,ring,bounds:{x:blueprint.x,y:blueprint.y,width:Math.max(...outline.map(p=>p.x)),height:Math.max(...outline.map(p=>p.y))}};
}
export function makeBlueprint(home,level,position){
  const source=floorDescriptors(home).find(f=>f.level===level);
  const section=source&&getSections(home).find(s=>s.level===source.level);
  return section?{id:makeId(),sourceSectionId:section.id,x:position.x,y:position.y,outline:localOutline(source)}:null;
}
export function changeBlueprintSource(home,id,level){
  const source=floorDescriptors(home).find(f=>f.level===level),section=source&&getSections(home).find(s=>s.level===level);
  if(!section)return home;
  return {...home,blueprints:(home.blueprints||[]).map(b=>b.id===id?{...b,sourceSectionId:section.id,outline:localOutline(source)}:b)};
}
