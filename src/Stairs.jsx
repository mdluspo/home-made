import React,{useId} from 'react';
import {stairBounds,stairGeometry} from './stairs.js';

const GREEN='#6c8755';
const path = (points,close=true) => 'M'+points.map(p=>`${Number(p.x.toFixed(5))},${Number(p.y.toFixed(5))}`).join(' L')+(close?' Z':'');
const raised = (p,z) => ({x:p.x,y:p.y-z});
const finite = (value,fallback) => Number.isFinite(value)?value:fallback;

/** Local, unscaled art. The parent owns all placement transforms. */
export function StairArt({stair,decorated=false}) {
  const id='stair-shadow-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const mesh=stairGeometry(stair);
  if(!decorated)return <g className={`stair-art stair-outline stair-${mesh.kind}`} fill="none" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
    {mesh.steps.map((step,i)=><path key={i} className="stair-plan-tread" d={path(step.points)} fill="none"/>)}
    <path className="stair-plan-boundary" d={path(mesh.footprint)} fill="none" strokeWidth="2"/>
  </g>;

  const bounds=stairBounds(stair,{decorated:true});
  const sorted=mesh.steps.map((step,i)=>({...step,i,depth:step.points.reduce((s,p)=>s+p.y-step.z,0)/step.points.length})).sort((a,b)=>a.depth-b.depth||a.i-b.i);
  return <g className={`stair-art stair-decorated stair-${mesh.kind}`} data-perspective="three-quarter" stroke="#817951" strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
    <defs><filter id={id} filterUnits="userSpaceOnUse" x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="2.5"/></filter></defs>
    <path className="stair-ground-shadow" d={path(mesh.footprint)} transform="translate(3 6)" fill="#596344" opacity=".17" stroke="none" filter={`url(#${id})`}/>
    {/* The outer stringers carry the stepped surfaces down to the floor. */}
    {mesh.rails.map((rail,i)=><path key={i} className="stair-stringer" d={path([...rail.map(p=>raised(p,p.z)),...rail.slice().reverse().map(p=>({x:p.x,y:p.y}))])} fill="#b49a73" stroke="#97835f"/>)}
    {sorted.map(step=><g key={step.i} className="stair-step" data-elevation={step.z}>
      {step.points.map((p,i)=>{const q=step.points[(i+1)%step.points.length];
        // Vertical plan edges project to a line. The other slab edges are risers.
        if(Math.abs(p.x-q.x)<.001)return null;
        return <path key={i} className="stair-riser" d={path([raised(p,step.z),raised(q,step.z),raised(q,step.z-2),raised(p,step.z-2)])} fill="#b99b71"/>;
      })}
      <path className="stair-tread" d={path(step.points.map(p=>raised(p,step.z)))} fill={step.i%2?'#e1c89e':'#e8d3ae'}/>
      <path className="stair-tread-nosing" d={path([step.points[0],step.points[step.points.length-1]].map(p=>raised(p,step.z)),false)} fill="none" stroke="#f6e9c9" strokeWidth="1.1"/>
    </g>)}
    {mesh.rails.map((rail,i)=>{
      const posts=rail.length>10?rail.filter((_,j)=>j%9===0||j===rail.length-1):rail;
      return <g key={i} className="stair-railing" fill="none">
        {posts.map((p,j)=><g key={j}><path className="stair-rail-post" d={path([raised(p,p.z),raised(p,p.z+12)],false)} stroke="#899476" strokeWidth="2"/><path d={path([raised({x:p.x-.4,y:p.y},p.z+1),raised({x:p.x-.4,y:p.y},p.z+11)],false)} stroke="#dce1bf" strokeWidth=".55"/></g>)}
        <path className="stair-handrail-shadow" d={path(rail.map(p=>raised(p,p.z+10)),false)} stroke="#596344" strokeWidth="3.6" opacity=".14"/>
        <path className="stair-handrail" d={path(rail.map(p=>raised(p,p.z+12)),false)} stroke="#788569" strokeWidth="3"/>
        <path d={path(rail.map(p=>raised({x:p.x,y:p.y-.5},p.z+12)),false)} stroke="#d8dfba" strokeWidth=".85"/>
      </g>;
    })}
  </g>;
}

/** Bold, unfilled 24px toolbar glyph, using the same footprint as the object. */
export function StairGlyph({kind='straight'}) {
  const mesh=stairGeometry({kind}),b=stairBounds({kind}),s=18/Math.max(b.width,b.height);
  const tx=12-(b.x+b.width/2)*s,ty=12-(b.y+b.height/2)*s;
  return <svg className="stair-glyph" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <g transform={`translate(${tx} ${ty}) scale(${s})`} fill="none">
      <path d={path(mesh.footprint)} fill="none" vectorEffect="non-scaling-stroke"/>
      {mesh.steps.filter((_,i)=>i%2===1).map((step,i)=><path key={i} d={path([step.points[0],step.points[step.points.length-1]],false)} fill="none" vectorEffect="non-scaling-stroke"/>)}
    </g>
  </svg>;
}

/** Pointer callbacks receive (event, stair), matching furniture interactions. */
export function StairObject({stair,decorated=false,onPointerDown,selected=false,onResize}) {
  const b=stairBounds(stair,{decorated}),mesh=stairGeometry(stair);
  const scale=Number.isFinite(stair?.scale)&&stair.scale>0?stair.scale:1;
  return <g className={`stair-object${selected?' selected':''}`} data-stair-id={stair?.id} transform={`translate(${finite(stair?.x,0)} ${finite(stair?.y,0)}) rotate(${finite(stair?.rotation,0)}) scale(${scale})`} onPointerDown={e=>{e.stopPropagation();onPointerDown?.(e,stair);}}>
    <path className="stair-hit-area" d={path(mesh.footprint)} fill="transparent" stroke="none" pointerEvents="all"/>
    {decorated&&<rect className="stair-raised-hit-area" {...b} fill="transparent" stroke="none" pointerEvents="all"/>}
    <StairArt stair={stair} decorated={decorated}/>
    {selected&&<g className="stair-selection" fill="none" stroke={GREEN} strokeWidth="1.2">
      <rect {...b} fill="none" strokeDasharray="4 3" pointerEvents="none"/>
      {onResize&&[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y],i)=><g key={i} className="stair-resize-handle" onPointerDown={e=>{e.stopPropagation();onResize(e,stair);}} style={{cursor:'nwse-resize'}}>
        <rect x={x-5} y={y-5} width="10" height="10" fill="transparent" stroke="none" pointerEvents="all"/>
        <rect x={x-3} y={y-3} width="6" height="6" fill="none" pointerEvents="none"/>
      </g>)}
    </g>}
  </g>;
}
