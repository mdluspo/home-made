import React, { useMemo } from 'react';
import { CATALOG, distanceToSegment, floorOutlines, getSections, homeSpawn, planArea, planToWorld, PLAN_UNIT, pointInHome, smoothPath } from './model.js';
import { outlineEdgeControls, outlineCorners } from './editor.js';
import {floorDescriptors} from './floors.js';
import {LevelLabels} from './LevelLabels.jsx';
import {StairObject} from './Stairs.jsx';
import {orderedObjects} from './layers.js';
import { combineDoorPairs, combineNearbyWindows, roomOpenings, roomWallEdges } from './roomWalls.js';

const linePath = points => points.length ? 'M' + points.map(p => `${p.x},${p.y}`).join(' L') : '';

export function Dimension({ a, b, offset = 31, live = false, onEdit }) {
  const length = Math.hypot(b.x-a.x,b.y-a.y);
  if (length < (onEdit ? 20 : 45)) return null;
  const nx=(b.y-a.y)/length,ny=-(b.x-a.x)/length;
  const x=(a.x+b.x)/2+nx*offset,y=(a.y+b.y)/2+ny*offset;
  let angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  if(angle>90)angle-=180;if(angle< -90)angle+=180;
  return <g className={`plan-dimension ${live?'live':''}`} pointerEvents="none" strokeWidth=".8" fill="none">
    <path d={`M${a.x+nx*15},${a.y+ny*15}L${a.x+nx*(offset+7)},${a.y+ny*(offset+7)}M${b.x+nx*15},${b.y+ny*15}L${b.x+nx*(offset+7)},${b.y+ny*(offset+7)}M${a.x+nx*offset},${a.y+ny*offset}L${b.x+nx*offset},${b.y+ny*offset}`}/>
    {[a,b].map((p,i)=><path key={i} d={`M${p.x+nx*offset-3},${p.y+ny*offset+3}l6-6`}/>)}
    <g className={onEdit?'editable-dimension-label':undefined} transform={`translate(${x} ${y}) rotate(${angle})`} pointerEvents={onEdit?'all':'none'} role={onEdit?'button':undefined} tabIndex={onEdit?0:undefined} aria-label={onEdit?`Set measurement, current ${(length/PLAN_UNIT).toFixed(2)} metres`:undefined} onPointerDown={onEdit?e=>{e.preventDefault();e.stopPropagation();onEdit(e);}:undefined} onKeyDown={onEdit?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onEdit(e);}}:undefined}>
      {onEdit&&<title>Click to enter an exact measurement in metres</title>}
      <rect x="-30" y="-12" width="60" height="24" rx="4" stroke="none" fill={live?'#e7eddb':'#f3f3e9'}/><text textAnchor="middle" y="3" fontSize="9" stroke="none">{(length/PLAN_UNIT).toFixed(2)} m</text>
    </g>
  </g>;
}

// Flood the walkable cells to label the spaces created by room dividers.
export function findRooms(home) {
  if (home.boundary.length < 3) return [];
  const allPoints=floorOutlines(home).flat();
  const step=10,minX=Math.floor(Math.min(...allPoints.map(p=>p.x))/step)*step,minY=Math.floor(Math.min(...allPoints.map(p=>p.y))/step)*step;
  const cols=Math.ceil((Math.max(...allPoints.map(p=>p.x))-minX)/step),rows=Math.ceil((Math.max(...allPoints.map(p=>p.y))-minY)/step);
  if(cols*rows>15000)return [{...homeSpawn(home),area:planArea(home.boundary)}];
  const cells=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const p={x:minX+x*step+step/2,y:minY+y*step+step/2};
    if(!pointInHome(p,home)||home.walls.some(w=>w.points.some((a,i)=>i>0&&distanceToSegment(p,w.points[i-1],a)<8)))cells[y*cols+x]=1;
  }
  const rooms=[];
  for(let n=0;n<cells.length;n++){
    if(cells[n])continue;
    const queue=[n];cells[n]=1;let head=0,sx=0,sy=0;
    while(head<queue.length){const at=queue[head++],x=at%cols,y=Math.floor(at/cols);sx+=x;sy+=y;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy,nn=yy*cols+xx;if(xx>=0&&xx<cols&&yy>=0&&yy<rows&&!cells[nn]){cells[nn]=1;queue.push(nn);}}
    }
    if(queue.length<14)continue;
    const cx=sx/queue.length,cy=sy/queue.length;
    const closest=queue.reduce((a,b)=>Math.hypot(a%cols-cx,Math.floor(a/cols)-cy)<Math.hypot(b%cols-cx,Math.floor(b/cols)-cy)?a:b);
    rooms.push({x:minX+(closest%cols)*step+step/2,y:minY+Math.floor(closest/cols)*step+step/2,area:home.walls.length||floorOutlines(home).length>1?queue.length*step**2/PLAN_UNIT**2:planArea(home.boundary)});
  }
  return rooms;
}

export function PlanFurniture({item:i,home,onPointerDown}){
  const meta=CATALOG.find(c=>c.type===i.type)||home.custom?.find(c=>c.id===i.type),w=(meta?.w||100)*i.scale*.5,h=(meta?.h||100)*i.scale*.35;
  return <g className="plan-furniture" data-item-id={i.id} transform={`translate(${i.x} ${i.y}) rotate(${i.rotation||0})`} onPointerDown={e=>onPointerDown?.(e,i)}>
    <rect x={-w/2} y={-h/2} width={w} height={h} rx="5" fill="transparent" stroke="#86a66f" strokeWidth="1.6" strokeDasharray="4 3"/>
    <text y="3" textAnchor="middle" fontSize="9" fill="#76955f" pointerEvents="none">{meta?.name||'Sticker'}</text>
  </g>;
}

export function FloorEdgeTargets({home,onResize}){
  if(!onResize)return null;
  const sections=getSections(home);
  return <g className="floor-edge-targets">{floorDescriptors(home).map(floor=>{
    const sectionIds=sections.filter(s=>s.level===floor.level).map(s=>s.id);
    return <g key={floor.level} data-edge-level={floor.level}>{outlineEdgeControls(floor.ring).map(edge=>{
      const {a,b,control,index}=edge,length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
      let spans=[[0,1]];
      // Keep doors and windows selectable instead of covering them with the
      // floor's resize target. Only the remaining exterior wall is draggable.
      for(const o of home.openings){
        if(distanceToSegment(o,a,b)>14||Math.abs(Math.sin(((o.angle||0)-angle)*Math.PI/180))>.35)continue;
        const at=((o.x-a.x)*(b.x-a.x)+(o.y-a.y)*(b.y-a.y))/length**2,half=((o.doorSpan||o.windowSpan||42)/2+10)/length;
        spans=spans.flatMap(([start,end])=>at+half<=start||at-half>=end?[[start,end]]:[[start,Math.max(start,at-half)],[Math.min(end,at+half),end]].filter(([x,y])=>y-x>.001));
      }
      const point=t=>`${a.x+(b.x-a.x)*t},${a.y+(b.y-a.y)*t}`;
      return <path key={index} className="floor-edge-resize-hit" d={spans.map(([start,end])=>`M${point(start)}L${point(end)}`).join(' ')} fill="none" stroke="transparent" strokeWidth="14" vectorEffect="non-scaling-stroke" pointerEvents="stroke" style={{cursor:edge.cursor}} aria-label={`Resize floor ${control.axis==='x'?'width':'height'}`} onPointerDown={e=>onResize(e,{sectionIds,control,index,level:floor.level})}/>;
    })}</g>;
  })}</g>;
}
export function FloorPlan({ home: savedHome, preview, selectedWall, selection, onWallDown, onBoundaryDown, onOpeningDown, onStairDown, onItemDown, onDimensionEdit, showObjects=true,showGrid,hideLevelLabels=false }) {
  const home=preview?.home||savedHome;
  const boundary=preview?.wallId==='boundary'?preview.points:home.boundary;
  const walls=home.walls.map(w=>w.id===preview?.wallId?{...w,points:preview.points}:w);
  const rooms=useMemo(()=>findRooms({...home,boundary,walls}),[home.boundary,home.walls,preview]);
  const alignedOpenings=useMemo(()=>roomOpenings({...home,boundary,walls},roomWallEdges({...home,boundary,walls})),[home,boundary,walls]);
  const renderedOpenings=useMemo(()=>combineDoorPairs(combineNearbyWindows(alignedOpenings)),[alignedOpenings]);
  const rings=[...floorOutlines(home),...(home.holes||[])];
  const outline=rings.map(r=>linePath(r)+' Z').join(' ');
  const sections=getSections(home);
  const ellipse=sections.length===1&&sections[0].type==='ellipse';
  const dimensionRings=ellipse?[outlineCorners(boundary)]:rings;
  const editLength=(e,a,b,wallId)=>onDimensionEdit?.(e,wallId?{kind:'wall',wallId,a,b}:{kind:'outline',sectionIds:sections.map(s=>s.id),a,b});
  return <g className="floor-plan">
    <defs><pattern id="plan-minor-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#bcc8ad" strokeOpacity=".25" strokeWidth=".6"/></pattern><pattern id="plan-major-grid" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#plan-minor-grid)"/><path d="M50 0H0V50" fill="none" stroke="#b4c0a5" strokeWidth=".7" strokeOpacity=".6"/></pattern></defs>
    {showGrid&&<rect x="-4000" y="-4000" width="9000" height="9000" fill="url(#plan-major-grid)" pointerEvents="none"/>}
    {!!boundary.length&&<>
      <path data-testid="plan-floor" d={outline} fill="#fbfaf2" fillRule="evenodd" stroke="none"/>
      {showGrid&&<path d={outline} fill="url(#plan-minor-grid)" pointerEvents="none"/>}
      <g className="joined-wall-network" fill="none" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none">
        <g className="wall-outlines" stroke="#7e8b70">
          <path data-testid="joined-plan-walls" className="exterior-wall-outline" d={outline} strokeWidth="12"/>
          {walls.map(w=><path key={w.id} className="divider-wall-outline" d={w.curved?smoothPath(w.points):linePath(w.points)} strokeWidth={Math.max(3,Number(w.thickness)||7)}/>)}
        </g>
        <g className="wall-centers" stroke="#fffef5">
          <path className="exterior-wall-center" d={outline} strokeWidth="4"/>
          {walls.map(w=><path key={w.id} className="divider-wall-center" d={w.curved?smoothPath(w.points):linePath(w.points)} strokeWidth={Math.max(1,Math.max(3,Number(w.thickness)||7)-4.5)}/>)}
        </g>
      </g>
      {sections.map(section=><path key={section.id} className="plan-section-hit plan-outer-wall" data-section-id={section.id} d={linePath(section.points)+' Z'} fill="transparent" stroke="transparent" strokeWidth="18" onPointerDown={e=>onBoundaryDown(e,{kind:'body',sectionId:section.id})}/>)}
      {dimensionRings.map((ring,ri)=>{const signed=ring.reduce((s,p,i)=>{const n=ring[(i+1)%ring.length];return s+p.x*n.y-n.x*p.y;},0);return ring.map((a,i)=>{const b=ring[(i+1)%ring.length],start=signed>=0?a:b,end=signed>=0?b:a;return ellipse&&i>1?null:<Dimension key={`${ri}-${i}`} a={start} b={end} onEdit={onDimensionEdit?e=>editLength(e,start,end):undefined}/>;});})}
      {rooms.map((room,i)=><g className="plan-room-label" key={i} transform={`translate(${room.x} ${room.y})`} pointerEvents="none"><text textAnchor="middle" y="-4" fontSize="10" fontWeight="600" letterSpacing="2">ROOM {String(i+1).padStart(2,'0')}</text><text textAnchor="middle" y="15" fontSize="10" opacity=".65">{room.area.toFixed(1)} m²</text></g>)}
    </>}
    {walls.map(w=>{const d=w.curved?smoothPath(w.points):linePath(w.points);return <g key={w.id} className="plan-divider" data-wall-id={w.id}>
      <path className="divider-body-hit" d={d} fill="none" stroke="transparent" strokeWidth="22" pointerEvents="stroke" onPointerDown={e=>onWallDown(e,w)}/>
      {selectedWall===w.id&&<Dimension a={w.points[0]} b={w.points.at(-1)} offset={24} onEdit={onDimensionEdit?e=>editLength(e,w.points[0],w.points.at(-1),w.id):undefined}/>}
      {[0,w.points.length-1].map(i=><g key={i}>
        <circle className="divider-end-hit" data-wall-end={i===0?'start':'end'} cx={w.points[i].x} cy={w.points[i].y} r="9" fill="transparent" onPointerDown={e=>onWallDown(e,w,i)}/>
        {selectedWall===w.id&&<rect className="plan-vertex" x={w.points[i].x-4.5} y={w.points[i].y-4.5} width="9" height="9" rx="2" fill="#fffdf0" stroke="#80986a" strokeWidth="1.5" pointerEvents="none"/>}
      </g>)}
    </g>;})}
      {renderedOpenings.map(o=>{const span=o.windowSpan||o.doorSpan||42;return <g key={o.id} className={`plan-opening plan-${o.type} ${o.doorSpan>42?'double-door':''}`} transform={`translate(${o.x} ${o.y}) rotate(${o.angle||0})`} onPointerDown={e=>onOpeningDown(e,o)}><path d={`M-${span/2} 0h${span}`} stroke="#fbfaf2" strokeWidth="15"/>{o.type==='door'?o.doorSpan>42?<g fill="none" stroke="#8b997a" strokeWidth="1.2"><path d="M-42 0v-40M42 0v-40" strokeWidth="2.4"/><path d="M-42-40A40 40 0 0 1 0 0M42-40A40 40 0 0 0 0 0" strokeDasharray="3 2"/><path d="M-44-7v14M44-7v14" stroke="#65715b" strokeWidth="2.5"/></g>:<g fill="none" stroke="#8b997a" strokeWidth="1.2"><path d="M-20 0v-40" strokeWidth="2.4"/><path d="M-20-40A40 40 0 0 1 20 0" strokeDasharray="3 2"/><path d="M-22-7v14M22-7v14" stroke="#65715b" strokeWidth="2.5"/></g>:<path className="window-line" d={`M-${span/2} 0h${span}`} fill="none" stroke="#7e8b70" strokeWidth="1.6"/>}</g>;})}
      <g className="plan-opening-hit-targets" pointerEvents="none">
        {alignedOpenings.map(o=><g key={`hit-${o.id}`} transform={`translate(${o.x} ${o.y}) rotate(${o.angle||0})`} pointerEvents="stroke" onPointerDown={e=>onOpeningDown(e,o)}>
          <path d="M-21 0H21" stroke="transparent" strokeWidth="24"/>
        </g>)}
      </g>
    {showObjects&&orderedObjects(home,{useLayers:false}).map(({kind,object})=>kind==='stair'?<StairObject key={object.id} stair={object} onPointerDown={onStairDown}/>:<PlanFurniture key={object.id} item={object} home={home} onPointerDown={onItemDown}/>)}
    {!hideLevelLabels&&<LevelLabels home={home}/>}
  </g>;
}

export function WorldStructure({ home }) {
  if(home.boundary.length<3)return null;
  const rings=[...floorOutlines(home),...(home.holes||[])].map(r=>r.map(planToWorld));
  const outline=rings.map(points=>linePath(points)+' Z').join(' ');
  const floorColor={oak:'#dec49c',birch:'#e9d9bb',tile:'#c6d0b7',rose:'#d4b8a5'}[home.floor];
  return <g className="world-structure" stroke="#7f8469" strokeLinejoin="round" strokeWidth="2">
    <defs><pattern id="world-floor" width="90" height="45" patternUnits="userSpaceOnUse" patternTransform="matrix(.78 .4 -.78 .4 540 285)"><rect width="90" height="45" fill={floorColor}/><path d={home.floor==='tile'?'M0 0h90v45H0zM45 0v45':'M0 0h90v45H0zM45 0v45M8 14h23m28 16h18'} stroke="#a99673" strokeOpacity=".28" strokeWidth="1.3" fill="none"/></pattern></defs>
    <path d={outline} transform="translate(0 13)" fill="#baa882" fillRule="evenodd"/>
    <path d={outline} fill="url(#world-floor)" fillRule="evenodd"/>
    {rings.map((points,ri)=>{const signed=points.reduce((s,p,i)=>{const n=points[(i+1)%points.length];return s+p.x*n.y-n.x*p.y;},0);return points.map((a,i)=>{const b=points[(i+1)%points.length];if((b.x-a.x)*(signed>=0?1:-1)<0)return null;return <g key={`${ri}-${i}`}><path d={`M${a.x} ${a.y}V${a.y-140}L${b.x} ${b.y-140}V${b.y}Z`} fill={home.wallColor}/><path d={`M${a.x} ${a.y-140}L${b.x} ${b.y-140}`} stroke="#f2eedb" strokeWidth="6"/><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#a6af91" strokeWidth="9"/></g>;});})}
    {home.walls.map(w=>{const ps=w.points.map(planToWorld),top=ps.map(p=>({...p,y:p.y-62}));return <g key={w.id}><path d={linePath(ps)+' L'+[...top].reverse().map(p=>`${p.x},${p.y}`).join(' L')+' Z'} fill={home.wallColor}/><path d={w.curved?smoothPath(top):linePath(top)} fill="none" stroke="#f0ecd9" strokeWidth="6"/></g>;})}
    {home.openings.map(o=>{const p=planToWorld(o);return <g key={o.id} transform={`translate(${p.x} ${p.y-30})`}><path d={o.type==='door'?'M-15 30v-70l30 15v70':'M-23-39l46 23v35L-23-4z'} fill={o.type==='door'?'#c5a77d':'#d5e3d8'} stroke="#8b9173" strokeWidth="2"/>{o.type==='window'&&<path d="M0-28v35M-21-20l42 22" stroke="#a7af93"/>}</g>;})}
  </g>;
}
