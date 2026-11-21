import { distanceToSegment, floorOutlines, furnitureVisualBounds, getSections, normalizePlan, pointInPolygon, snapSection } from './model.js';

export const emptySelection=()=>({boundary:false,sections:[],walls:[],items:[],openings:[]});
export const selectionCount=s=>Number(s.boundary)+(s.sections?.length||0)+s.walls.length+s.items.length+s.openings.length;
export function transformFurniture(home,ids,action){
  const chosen=new Set(home.items.filter(i=>ids.includes(i.id)&&!i.locked).map(i=>i.id));
  if(!chosen.size)return home;
  if(action==='forward'||action==='backward'){
    const items=[...home.items];
    if(action==='forward'){
      for(let i=items.length-2;i>=0;i--)if(chosen.has(items[i].id)&&!chosen.has(items[i+1].id))[items[i],items[i+1]]=[items[i+1],items[i]];
    }else{
      for(let i=1;i<items.length;i++)if(chosen.has(items[i].id)&&!chosen.has(items[i-1].id))[items[i],items[i-1]]=[items[i-1],items[i]];
    }
    return {...home,items};
  }
  if(!['rotate','rotateBack','flip'].includes(action))return home;
  return {...home,items:home.items.map(i=>{
    if(!chosen.has(i.id))return i;
    if(action==='flip')return {...i,flipped:!i.flipped};
    const angle=((i.rotation||0)%360+360)%360;
    const next=action==='rotateBack'?(Math.ceil((angle-.001)/45)-1)*45:(Math.floor((angle+.001)/45)+1)*45;
    return {...i,rotation:(next+360)%360};
  })};
}
export const boxFromPoints=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)});
const contains=(r,p)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;
const same=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<.1;
const shifted=(p,d)=>({...p,x:p.x+d.x,y:p.y+d.y});
function segmentMeetsBox(a,b,r){
  if(contains(r,a)||contains(r,b))return true;
  let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
  for(const [p,q] of [[-dx,a.x-r.x],[dx,r.x+r.width-a.x],[-dy,a.y-r.y],[dy,r.y+r.height-a.y]]){
    if(Math.abs(p)<1e-8){if(q<0)return false;continue;}
    const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
  }return true;
}
export function selectInBox(home,rect,mode='build'){
  const s=emptySelection();
  if(mode==='build'){
    if(home.sections?.length)s.sections=home.sections.filter(s=>s.points.every(p=>contains(rect,p))).map(s=>s.id);
    else s.boundary=home.boundary.length>2&&home.boundary.every(p=>contains(rect,p));
    s.walls=home.walls.filter(w=>w.points.some((p,i)=>i>0&&segmentMeetsBox(w.points[i-1],p,rect))).map(w=>w.id);
    s.openings=home.openings.filter(o=>contains(rect,o)).map(o=>o.id);
  }
  s.items=home.items.filter(i=>!i.locked&&contains(rect,i)).map(i=>i.id);
  return s;
}
export function mergeSelection(a,b){return {boundary:a.boundary||b.boundary,sections:[...new Set([...(a.sections||[]),...(b.sections||[])])],walls:[...new Set([...a.walls,...b.walls])],items:[...new Set([...a.items,...b.items])],openings:[...new Set([...a.openings,...b.openings])]};}
export function selectionBounds(home,s,mode='build'){
  const points=[];
  if(s.boundary)points.push(...home.boundary);
  for(const section of getSections(home))if(s.sections?.includes(section.id))points.push(...section.points);
  for(const w of home.walls)if(s.walls.includes(w.id))points.push(...w.points);
  for(const o of home.openings)if(s.openings.includes(o.id))points.push(o);
  for(const i of home.items)if(s.items.includes(i.id)){
    const b=furnitureVisualBounds(i.type),angle=i.rotation*Math.PI/180;
    for(const [x,y] of [[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]])points.push({x:i.x+(x*Math.cos(angle)-y*Math.sin(angle))*i.scale,y:i.y+(x*Math.sin(angle)+y*Math.cos(angle))*i.scale});
  }
  if(!points.length)return null;
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  return {x:minX-12,y:minY-12,width:maxX-minX+24,height:maxY-minY+24};
}
function constrainToOriginalBoundary(point,original,home){
  let closest=null;
  for(const boundary of [...floorOutlines(home),...(home.holes||[])])for(let i=0;i<boundary.length;i++){
    const a=boundary[i],b=boundary[(i+1)%boundary.length];if(distanceToSegment(original,a,b)>.1)continue;
    const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    const projected={x:a.x+t*dx,y:a.y+t*dy},distance=Math.hypot(point.x-projected.x,point.y-projected.y);
    if(!closest||distance<closest.distance)closest={projected,distance};
  }return closest?.projected||point;
}
// A generated join becomes an ordinary divider as soon as it is edited.
// Preserve every piece of that seam before suppressing its generated version.
function detachJoins(home,ids){
  const keys=new Set(home.walls.filter(w=>ids.includes(w.id)&&w.source==='join').map(w=>w.joinKey));
  if(!keys.size)return home;
  return {...home,removedJoins:[...new Set([...(home.removedJoins||[]),...keys])],walls:home.walls.map(w=>{
    if(!keys.has(w.joinKey))return w;
    const {joinKey,...wall}=w;return {...wall,source:'manual'};
  })};
}
export function moveSelection(home,s,delta){
  if(s.boundary)return {...home,boundary:home.boundary.map(p=>shifted(p,delta)),sections:getSections(home).map(section=>({...section,points:section.points.map(p=>shifted(p,delta))})),outlines:floorOutlines(home).map(r=>r.map(p=>shifted(p,delta))),holes:(home.holes||[]).map(r=>r.map(p=>shifted(p,delta))),walls:home.walls.map(w=>({...w,points:w.points.map(p=>shifted(p,delta))})),items:home.items.map(i=>shifted(i,delta)),openings:home.openings.map(o=>shifted(o,delta))};
  if(s.sections?.length)return transformFloorSections(home,s.sections,p=>shifted(p,delta),true);
  home=detachJoins(home,s.walls);
  const movedNodes=[];
  for(const w of home.walls)if(s.walls.includes(w.id))for(const p of w.points)movedNodes.push({from:p,to:constrainToOriginalBoundary(shifted(p,delta),p,home)});
  const moveNode=p=>movedNodes.find(n=>same(n.from,p))?.to||p;
  return {...home,walls:home.walls.map(w=>({...w,points:w.points.map(moveNode)})),items:home.items.map(i=>s.items.includes(i.id)?shifted(i,delta):i),openings:home.openings.map(o=>{
    if(s.openings.includes(o.id))return shifted(o,delta);
    const wall=home.walls.find(w=>s.walls.includes(w.id)&&w.points.some((p,i)=>i>0&&distanceToSegment(o,w.points[i-1],p)<1));
    return wall?shifted(o,delta):o;
  })};
}
export function moveVertex(home,wallId,index,target){
  const sectionId=wallId.startsWith('section:')?wallId.slice(8):null;
  const original=sectionId?getSections(home).find(s=>s.id===sectionId)?.points[index]:wallId==='boundary'?home.boundary[index]:home.walls.find(w=>w.id===wallId)?.points[index];
  if(!original)return home;
  if(!sectionId&&wallId!=='boundary'){
    home=detachJoins(home,[wallId]);
    const constrained=constrainToOriginalBoundary(target,original,home);
    const replace=p=>same(p,original)?{...constrained}:p;
    return {...home,walls:home.walls.map(w=>({...w,points:w.points.map(replace)})),openings:home.openings.map(o=>same(o,original)?{...o,...constrained}:o)};
  }
  const replace=p=>same(p,original)?{x:target.x,y:target.y}:p;
  const sections=getSections(home).map(s=>({...s,points:(!sectionId||s.id===sectionId)?s.points.map(replace):s.points}));
  const changed={...home,sections,boundary:home.boundary.map(replace),walls:home.walls.map(w=>({...w,points:w.points.map(replace)})),openings:home.openings.map(o=>same(o,original)?{...o,...target}:o)};
  return sectionId?normalizePlan(changed):changed;
}
const belongs=(p,section)=>pointInPolygon(p,section.points)||section.points.some((a,i)=>distanceToSegment(p,a,section.points[(i+1)%section.points.length])<.1);
function transformFloorSections(home,ids,transform,snap=false){
  const originals=getSections(home),chosen=originals.filter(s=>ids.includes(s.id)),stationary=originals.filter(s=>!ids.includes(s.id));
  const transformed=chosen.map(s=>{const next={...s,points:s.points.map(transform)};return snap?snapSection(next,stationary):next;});
  // Keep the source shape intact. Union rendering hides overlaps, while the
  // stationary sections come first and retain ownership of shared dividers.
  const moved=transformed;
  // Carry belongings with the selected section; generated seams are rebuilt
  // from the new layout rather than dragged as loose wall objects.
  const movePoint=p=>{const section=chosen.find(s=>belongs(p,s));if(!section)return p;const before=transform(section.points[0]),after=transformed.find(s=>s.id===section.id).points[0],q=transform(p);return {...p,x:q.x+after.x-before.x,y:q.y+after.y-before.y};};
  return normalizePlan({...home,sections:[...stationary,...moved],walls:home.walls.filter(w=>w.source!=='join').map(w=>({...w,points:w.points.map(movePoint)})),items:home.items.map(movePoint),openings:home.openings.map(movePoint)});
}
export function outlineBounds(boundary){
  if(!boundary.length)return null;
  const x=Math.min(...boundary.map(p=>p.x)),y=Math.min(...boundary.map(p=>p.y));
  return {x,y,width:Math.max(...boundary.map(p=>p.x))-x,height:Math.max(...boundary.map(p=>p.y))-y};
}
export function outlineCorners(boundary){
  const b=outlineBounds(boundary);if(!b)return [];
  return [{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}];
}
export function isRoundOutline(home){
  if(home.outlineType==='ellipse')return true;
  if(home.boundary.length<16)return false;
  const b=outlineBounds(home.boundary),rx=b.width/2,ry=b.height/2;if(!rx||!ry)return false;
  return home.boundary.every(p=>Math.abs(((p.x-b.x-rx)/rx)**2+((p.y-b.y-ry)/ry)**2-1)<.035);
}
function contourIndices(points){
  if(points.length<=24)return points.map((_,i)=>i);
  const keep=new Set([0]);
  const farthest=points.reduce((best,p,i)=>Math.hypot(p.x-points[0].x,p.y-points[0].y)>Math.hypot(points[best].x-points[0].x,points[best].y-points[0].y)?i:best,0);
  const simplify=(start,end)=>{const a=points[start%points.length],b=points[end%points.length];let at=-1,max=2.5;for(let i=start+1;i<end;i++){const d=distanceToSegment(points[i%points.length],a,b);if(d>max){max=d;at=i;}}if(at>=0){keep.add(at%points.length);simplify(start,at);simplify(at,end);}};
  keep.add(farthest);simplify(0,farthest);simplify(farthest,points.length);
  let indices=[...keep].sort((a,b)=>a-b);
  if(indices.length>32)indices=Array.from({length:32},(_,i)=>indices[Math.floor(i*indices.length/32)]);
  for(const axis of ['x','y'])for(const sign of [-1,1])indices.push(points.reduce((best,p,i)=>p[axis]*sign>points[best][axis]*sign?i:best,0));
  return [...new Set(indices)].sort((a,b)=>a-b);
}
// Round shapes have four controls ON the ellipse. Other contours use their
// own vertices, rather than corners of an empty enclosing rectangle.
export function outlineControls(points,type='custom',mode='resize'){
  const b=outlineBounds(points);if(!b)return [];
  const cx=b.x+b.width/2,cy=b.y+b.height/2;
  const round=type==='ellipse'||(!['polygon','freeform','boundary','rectangle'].includes(type)&&isRoundOutline({boundary:points}));
  if(round)return [
    {x:cx,y:b.y,anchor:{x:cx,y:b.y+b.height},axis:'y',cursor:'ns-resize'},
    {x:b.x+b.width,y:cy,anchor:{x:b.x,y:cy},axis:'x',cursor:'ew-resize'},
    {x:cx,y:b.y+b.height,anchor:{x:cx,y:b.y},axis:'y',cursor:'ns-resize'},
    {x:b.x,y:cy,anchor:{x:b.x+b.width,y:cy},axis:'x',cursor:'ew-resize'},
  ].map((p,index)=>({...p,index,kind:'resize'}));
  return contourIndices(points).map(index=>{
    const p=points[index],right=p.x>cx,bottom=p.y>cy;
    return {...p,index,kind:mode==='points'?'vertex':'resize',axis:'both',anchor:{x:right?b.x:b.x+b.width,y:bottom?b.y:b.y+b.height},cursor:mode==='points'?'crosshair':right===bottom?'nwse-resize':'nesw-resize'};
  });
}
// Ordinary resizing changes width and height independently. Shift or the
// explicit proportional mode keeps the original aspect ratio.
export function resizeOutline(home,corner,target,{proportional=false,sectionId=null,control=null}={}){
  const section=sectionId?getSections(home).find(s=>s.id===sectionId):null;
  const corners=outlineCorners(section?.points||home.boundary);if(corners.length!==4)return home;
  const anchor=control?.anchor||corners[(corner+2)%4],handle=control||corners[corner],b=outlineBounds(section?.points||home.boundary);
  const dx=handle.x-anchor.x,dy=handle.y-anchor.y;
  let sx=control?.axis==='y'||Math.abs(dx)<.001?1:(target.x-anchor.x)/dx,sy=control?.axis==='x'||Math.abs(dy)<.001?1:(target.y-anchor.y)/dy;
  if(proportional){const scale=Math.abs(sx-1)>=Math.abs(sy-1)?sx:sy;const safe=Math.max(20/Math.min(b.width,b.height),scale);sx=safe;sy=safe;}
  else{sx=Math.max(20/b.width,sx);sy=Math.max(20/b.height,sy);}
  const transform=p=>({...p,x:anchor.x+(p.x-anchor.x)*sx,y:anchor.y+(p.y-anchor.y)*sy});
  if(sectionId)return transformFloorSections(home,[sectionId],transform);
  return {...home,boundary:home.boundary.map(transform),sections:getSections(home).map(s=>({...s,points:s.points.map(transform)})),outlines:floorOutlines(home).map(r=>r.map(transform)),holes:(home.holes||[]).map(r=>r.map(transform)),walls:home.walls.map(w=>({...w,points:w.points.map(transform)})),items:home.items.map(transform),openings:home.openings.map(o=>({...transform(o),angle:Math.atan2(Math.sin((o.angle||0)*Math.PI/180)*sy,Math.cos((o.angle||0)*Math.PI/180)*sx)*180/Math.PI}))};
}
export function deleteSelection(home,s){
  const sections=getSections(home).filter(section=>!s.boundary&&!s.sections?.includes(section.id));
  const removedJoins=[...new Set([...(home.removedJoins||[]),...home.walls.filter(w=>s.walls.includes(w.id)&&w.joinKey).map(w=>w.joinKey)])];
  const changed={...home,sections,removedJoins,boundary:s.boundary||!sections.length?[]:home.boundary,outlines:s.boundary||!sections.length?[]:home.outlines,walls:s.boundary?[]:home.walls.filter(w=>!s.walls.includes(w.id)),items:home.items.filter(i=>!s.items.includes(i.id)||i.locked),openings:s.boundary?[]:home.openings.filter(o=>!s.openings.includes(o.id))};
  return s.sections?.length?normalizePlan(changed):changed;
}
