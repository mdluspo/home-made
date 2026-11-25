import { CATALOG, distanceToSegment, extendDivider, floorOutlines, furnitureVisualBounds, getSections, normalizePlan, PLAN_UNIT, pointInPolygon, snapSection, withFloorOrigins } from './model.js';
import {stairBounds} from './stairs.js';
import {objectFloorLevel} from './floors.js';
import {reorderObjects} from './layers.js';

export const emptySelection=()=>({boundary:false,sections:[],walls:[],items:[],openings:[],stairs:[]});
export const selectionCount=s=>Number(s.boundary)+(s.sections?.length||0)+s.walls.length+s.items.length+s.openings.length+(s.stairs?.length||0);
export function transformFurniture(home,ids,action){
  const chosen=new Set(home.items.filter(i=>ids.includes(i.id)&&!i.locked).map(i=>i.id));
  if(!chosen.size)return home;
  if(action==='forward'||action==='backward'){
    return reorderObjects(home,[...chosen],action);
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
  s.stairs=(home.stairs||[]).filter(i=>contains(rect,i)).map(i=>i.id);
  return s;
}
export function mergeSelection(a,b){return {boundary:a.boundary||b.boundary,sections:[...new Set([...(a.sections||[]),...(b.sections||[])])],walls:[...new Set([...a.walls,...b.walls])],items:[...new Set([...a.items,...b.items])],openings:[...new Set([...a.openings,...b.openings])],stairs:[...new Set([...(a.stairs||[]),...(b.stairs||[])])]};}
export function selectionBounds(home,s,mode='build'){
  const points=[];
  if(s.boundary)points.push(...home.boundary);
  for(const section of getSections(home))if(s.sections?.includes(section.id))points.push(...section.points);
  for(const w of home.walls)if(s.walls.includes(w.id))points.push(...w.points);
  for(const o of home.openings)if(s.openings.includes(o.id))points.push(o);
  for(const stair of home.stairs||[])if(s.stairs?.includes(stair.id)){
    const b=stairBounds(stair,{decorated:mode!=='build'}),r=(stair.rotation||0)*Math.PI/180,scale=stair.scale||1;
    for(const [x,y] of [[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]])points.push({x:stair.x+(x*Math.cos(r)-y*Math.sin(r))*scale,y:stair.y+(x*Math.sin(r)+y*Math.cos(r))*scale});
  }
  for(const i of home.items)if(s.items.includes(i.id)){
    const meta=CATALOG.find(c=>c.type===i.type)||home.custom?.find(c=>c.id===i.type),w=(meta?.w||100)*.5,h=(meta?.h||100)*.35;
    const b=mode==='build'?{x:-w/2,y:-h/2,width:w,height:h}:furnitureVisualBounds(i.type),angle=(i.rotation||0)*Math.PI/180;
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
export function setWallThickness(home,id,value){
  home=detachJoins(home,[id]);
  return {...home,walls:home.walls.map(w=>w.id===id?{...w,thickness:Math.max(3,Math.min(20,Number(value)||7))}:w)};
}
export function moveSelection(home,s,delta){
  home=withFloorOrigins(home);
if(s.boundary)return {...home,boundary:home.boundary.map(p=>shifted(p,delta)),sections:getSections(home).map(section=>({...section,points:section.points.map(p=>shifted(p,delta))})),outlines:floorOutlines(home).map(r=>r.map(p=>shifted(p,delta))),holes:(home.holes||[]).map(r=>r.map(p=>shifted(p,delta))),walls:home.walls.map(w=>({...w,points:w.points.map(p=>shifted(p,delta))})),stairs:(home.stairs||[]).map(i=>shifted(i,delta)),items:home.items.map(i=>shifted(i,delta)),openings:home.openings.map(o=>shifted(o,delta)),...(home.roomDecor?{roomDecor:home.roomDecor.map(r=>shifted(r,delta))}:{})};
  if(s.sections?.length)return transformFloorSections(home,s.sections,p=>shifted(p,delta),true);
  home=detachJoins(home,s.walls);
  const movedNodes=[];
  for(const w of home.walls)if(s.walls.includes(w.id))for(const p of w.points)movedNodes.push({from:p,to:constrainToOriginalBoundary(shifted(p,delta),p,home)});
  const moveNode=p=>movedNodes.find(n=>same(n.from,p))?.to||p;
  const moveObject=i=>({...shifted(i,delta),level:objectFloorLevel(home,i)});
  return {...home,walls:home.walls.map(w=>({...w,points:w.points.map(moveNode)})),stairs:(home.stairs||[]).map(i=>s.stairs?.includes(i.id)?moveObject(i):i),items:home.items.map(i=>s.items.includes(i.id)?moveObject(i):i),openings:home.openings.map(o=>{
    if(s.openings.includes(o.id))return shifted(o,delta);
    const wall=home.walls.find(w=>s.walls.includes(w.id)&&w.points.some((p,i)=>i>0&&distanceToSegment(o,w.points[i-1],p)<1));
    return wall?shifted(o,delta):o;
  })};
}
export function moveVertex(home,wallId,index,target){
  home=withFloorOrigins(home);
  const sectionId=wallId.startsWith('section:')?wallId.slice(8):null;
  const original=sectionId?getSections(home).find(s=>s.id===sectionId)?.points[index]:wallId==='boundary'?home.boundary[index]:home.walls.find(w=>w.id===wallId)?.points[index];
  if(!original)return home;
  if(!sectionId&&wallId!=='boundary'){
    home=detachJoins(home,[wallId]);
    let constrained=constrainToOriginalBoundary(target,original,home);
    const wall=home.walls.find(w=>w.id===wallId);
    if(index===0||index===wall.points.length-1){
      const draft={...wall,points:wall.points.map((p,i)=>i===index?constrained:p)};
      constrained=extendDivider(home,draft,{indices:[index]}).points[index];
    }
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
  home=withFloorOrigins(home);
  const originals=getSections(home),chosen=originals.filter(s=>ids.includes(s.id)),stationary=originals.filter(s=>!ids.includes(s.id));
  const transformed=chosen.map(s=>{const next={...s,points:s.points.map(transform)};return snap?snapSection(next,stationary):next;});
  // Keep the source shape intact. Union rendering hides overlaps, while the
  // stationary sections come first and retain ownership of shared dividers.
  const moved=transformed;
  // Carry belongings with the selected section; generated seams are rebuilt
  // from the new layout rather than dragged as loose wall objects.
  const movePoint=p=>{const section=chosen.find(s=>belongs(p,s))||(p.id&&!originals.some(s=>belongs(p,s))?chosen.find(s=>s.level===objectFloorLevel(home,p)):null);if(!section)return p;const before=transform(section.points[0]),after=transformed.find(s=>s.id===section.id).points[0],q=transform(p);return {...p,x:q.x+after.x-before.x,y:q.y+after.y-before.y};};
  return normalizePlan({...home,sections:[...stationary,...moved],walls:home.walls.filter(w=>w.source!=='join').map(w=>({...w,points:w.points.map(movePoint)})),stairs:(home.stairs||[]).map(movePoint),items:home.items.map(movePoint),openings:home.openings.map(movePoint),...(home.roomDecor?{roomDecor:home.roomDecor.map(movePoint)}:{})});
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
// Only real bends get corner targets: sampled ellipses keep their edge cursors.
// Scale about the opposite bounds corner, carrying the entire footprint with it.
export function outlineCornerControls(points){
  const b=outlineBounds(points);if(!b||!b.width||!b.height)return [];
  const cx=b.x+b.width/2,cy=b.y+b.height/2;
  return points.flatMap((p,index)=>{
    const prev=points[(index+points.length-1)%points.length],next=points[(index+1)%points.length];
    const ax=p.x-prev.x,ay=p.y-prev.y,bx=next.x-p.x,by=next.y-p.y;
    const lengths=Math.hypot(ax,ay)*Math.hypot(bx,by);
    if(lengths<.01||Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by)/lengths)))<Math.PI/7)return [];
    const right=p.x>=cx,bottom=p.y>=cy;
    return [{point:p,index,control:{...p,axis:'both',anchor:{x:right?b.x:b.x+b.width,y:bottom?b.y:b.y+b.height}},cursor:right===bottom?'nwse-resize':'nesw-resize'}];
  });
}
export function outlineEdgeControls(points){
  const b=outlineBounds(points);if(!b)return [];
  const cx=b.x+b.width/2,cy=b.y+b.height/2;
  return points.flatMap((a,index)=>{
    const end=points[(index+1)%points.length],dx=end.x-a.x,dy=end.y-a.y;
    if(Math.hypot(dx,dy)<.1)return [];
    const axis=Math.abs(dx)>=Math.abs(dy)?'y':'x';
    const positive=axis==='x'?(a.x+end.x)/2>=cx:(a.y+end.y)/2>=cy;
    const control=axis==='x'?{x:positive?b.x+b.width:b.x,y:cy,anchor:{x:positive?b.x:b.x+b.width,y:cy},axis}:{x:cx,y:positive?b.y+b.height:b.y,anchor:{x:cx,y:positive?b.y:b.y+b.height},axis};
    return [{a,b:end,index,control,cursor:axis==='x'?'ew-resize':'ns-resize'}];
  });
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
  if(mode==='points')return contourIndices(points).map(index=>({...points[index],index,kind:'vertex',cursor:'crosshair'}));
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
export function resizeOutline(home,corner,target,{proportional=false,sectionId=null,sectionIds=null,control=null}={}){
  home=withFloorOrigins(home);
  const ids=sectionIds||(sectionId?[sectionId]:null);
  const points=ids?getSections(home).filter(s=>ids.includes(s.id)).flatMap(s=>s.points):home.boundary;
  const corners=outlineCorners(points);if(corners.length!==4)return home;
  const anchor=control?.anchor||corners[(corner+2)%4],handle=control||corners[corner],b=outlineBounds(points);
  const dx=handle.x-anchor.x,dy=handle.y-anchor.y;
  let sx=control?.axis==='y'||Math.abs(dx)<.001?1:(target.x-anchor.x)/dx,sy=control?.axis==='x'||Math.abs(dy)<.001?1:(target.y-anchor.y)/dy;
  if(proportional){const scale=Math.abs(sx-1)>=Math.abs(sy-1)?sx:sy;const safe=Math.max(20/Math.min(b.width,b.height),scale);sx=safe;sy=safe;}
  else{sx=Math.max(20/b.width,sx);sy=Math.max(20/b.height,sy);}
  const transform=p=>({...p,x:anchor.x+(p.x-anchor.x)*sx,y:anchor.y+(p.y-anchor.y)*sy});
  if(ids)return transformFloorSections(home,ids,transform);
  return {...home,boundary:home.boundary.map(transform),sections:getSections(home).map(s=>({...s,points:s.points.map(transform)})),outlines:floorOutlines(home).map(r=>r.map(transform)),holes:(home.holes||[]).map(r=>r.map(transform)),walls:home.walls.map(w=>({...w,points:w.points.map(transform)})),stairs:(home.stairs||[]).map(transform),items:home.items.map(transform),openings:home.openings.map(o=>({...transform(o),angle:Math.atan2(Math.sin((o.angle||0)*Math.PI/180)*sy,Math.cos((o.angle||0)*Math.PI/180)*sx)*180/Math.PI})),...(home.roomDecor?{roomDecor:home.roomDecor.map(transform)}:{})};
}

// Exact lengths use the same geometry as dragging. Horizontal/vertical edges
// change one axis; a diagonal scales proportionally so its angles stay intact.
export function setPlanMeasurement(home,measurement,metres){
  const original=home,fail=error=>({home:original,error});
  if(!Number.isFinite(metres)||metres<=0)return fail('Enter a positive measurement in metres.');
  const {a,b}=measurement,length=Math.hypot(b.x-a.x,b.y-a.y),target=metres*PLAN_UNIT;
  if(!Number.isFinite(target)||target>=20000)return fail('That measurement is too large for the drawing area.');
  if(length<.01)return fail('This edge is too short to resize.');
  if(Math.abs(target-length)<.00001)return {home,error:null};
  const ratio=target/length,dx=b.x-a.x,dy=b.y-a.y;
  const sx=Math.abs(dx)<.001?1:ratio,sy=Math.abs(dy)<.001?1:ratio;
  const transform=p=>({...p,x:a.x+(p.x-a.x)*sx,y:a.y+(p.y-a.y)*sy});
  let next;
  if(measurement.kind==='wall'){
    home=detachJoins(home,[measurement.wallId]);
    const wall=home.walls.find(w=>w.id===measurement.wallId);
    if(!wall||!same(wall.points[0],a)||!same(wall.points.at(-1),b))return fail('The wall changed. Click its measurement again.');
    const points=wall.points.map(transform);
    if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>=10000||Math.abs(p.y)>=10000))return fail('That size is outside the drawing area.');
    const replace=p=>{const index=wall.points.findIndex(q=>same(p,q));return index<0?p:{...points[index]};};
    const onWall=p=>wall.points.some((q,i)=>i>0&&distanceToSegment(p,wall.points[i-1],q)<1);
    next=normalizePlan({...home,walls:home.walls.map(w=>({...w,points:w.id===wall.id?points:w.points.map(replace)})),openings:home.openings.map(o=>onWall(o)?transform(o):o)});
    const edited=next.walls.find(w=>w.id===wall.id);
    if(!edited||Math.abs(Math.hypot(edited.points.at(-1).x-edited.points[0].x,edited.points.at(-1).y-edited.points[0].y)-target)>.1)return fail('That length does not fit inside this floor plan.');
  }else{
    const ids=measurement.sectionIds||[],sections=getSections(home).filter(s=>ids.includes(s.id));
    if(!sections.length||sections.length!==ids.length)return fail('The floor changed. Click its measurement again.');
    const currentRings=[...floorOutlines(home),...(home.holes||[])];
    const currentEdge=currentRings.some(r=>r.some((p,i)=>same(p,a)&&same(r[(i+1)%r.length],b)||same(p,b)&&same(r[(i+1)%r.length],a)));
    // Ellipse dimensions measure its bounding box, rather than short chords.
    const bounds=outlineBounds(sections.flatMap(s=>s.points)),corners=outlineCorners(sections.flatMap(s=>s.points));
    const boxEdge=corners.some((p,i)=>same(p,a)&&same(corners[(i+1)%4],b)||same(p,b)&&same(corners[(i+1)%4],a));
    if(!currentEdge&&!boxEdge)return fail('The outline changed. Click its measurement again.');
    if(bounds.width*sx<20||bounds.height*sy<20)return fail('Floor width and height must be at least 0.40 m.');
    if(sections.some(s=>s.points.map(transform).some(p=>Math.abs(p.x)>=10000||Math.abs(p.y)>=10000)))return fail('That size is outside the drawing area.');
    next=transformFloorSections(home,ids,transform);
    if(getSections(home).some(s=>next.sections.find(n=>n.id===s.id)?.level!==s.level))return fail('That size would overlap another floor plan. Move the plans farther apart first.');
  }
  return {home:next,error:null};
}
export function deleteSelection(home,s){
  const sections=getSections(home).filter(section=>!s.boundary&&!s.sections?.includes(section.id));
  const removedJoins=[...new Set([...(home.removedJoins||[]),...home.walls.filter(w=>s.walls.includes(w.id)&&w.joinKey).map(w=>w.joinKey)])];
  const changed={...home,sections,removedJoins,boundary:s.boundary||!sections.length?[]:home.boundary,outlines:s.boundary||!sections.length?[]:home.outlines,walls:s.boundary?[]:home.walls.filter(w=>!s.walls.includes(w.id)),items:home.items.filter(i=>!s.items.includes(i.id)||i.locked),openings:s.boundary?[]:home.openings.filter(o=>!s.openings.includes(o.id))};
  if(home.roomDecor)changed.roomDecor=home.roomDecor.filter(r=>!s.boundary&&!getSections(home).some(section=>s.sections?.includes(section.id)&&belongs(r,section)));
  changed.stairs=(home.stairs||[]).filter(stair=>!s.boundary&&!s.stairs?.includes(stair.id)&&!getSections(home).some(section=>s.sections?.includes(section.id)&&belongs(stair,section)));
  return s.sections?.length?normalizePlan(changed):changed;
}
