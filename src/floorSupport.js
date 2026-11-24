import clipping from 'polygon-clipping';
import {floorDescriptors,floorHome,previousFloorBlueprint} from './floors.js';
import {PLAN_UNIT} from './model.js';

const ringArea=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
// A geometric design cue, not a structural calculation or a pillar generator.
// Overhangs depend on footprint containment, not total floor area alone.
export function floorOverhang(home,level){
  const floors=floorDescriptors(home),active=floors.find(f=>f.level===level),lower=floors.filter(f=>f.level<level).at(-1);
  if(!active||!lower)return null;
  const data=floorHome(home,active),under=floorHome(home,lower),reference=previousFloorBlueprint(home,level);
  const dx=reference.ring[0].x-lower.ring[0].x,dy=reference.ring[0].y-lower.ring[0].y;
  const polygon=(ring,dx=0,dy=0)=>ring.map(p=>[p.x+dx,p.y+dy]);
  const geometry=clipping.difference([polygon(active.ring),...data.holes.map(r=>polygon(r))],[polygon(lower.ring,dx,dy),...under.holes.map(r=>polygon(r,dx,dy))]);
  const area=geometry.reduce((sum,poly)=>sum+ringArea(poly[0])-poly.slice(1).reduce((a,r)=>a+ringArea(r),0),0)/PLAN_UNIT**2;
  return area>.001?{level,belowLevel:lower.level,area,floor:active}:null;
}
