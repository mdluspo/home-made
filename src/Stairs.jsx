import React,{useId} from 'react';
import {projectStairPoint,stairBounds,stairGeometry,stairScreenDepth} from './stairs.js';
import {gameCursor} from './cursors.js';

const GREEN='#6c8755';
const path = (points,close=true) => 'M'+points.map(p=>`${Number(p.x.toFixed(5))},${Number(p.y.toFixed(5))}`).join(' L')+(close?' Z':'');
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
  const rotation=finite(stair?.rotation,0),r=rotation*Math.PI/180;
  const raised=(p,z)=>projectStairPoint(p,z,rotation),depth=p=>stairScreenDepth(p,rotation);
  const surfaces=mesh.steps.map((step,i)=>({kind:'step',step,i,depth:step.points.reduce((sum,p)=>sum+depth(p),0)/step.points.length}));
  // Sort side panels, treads and rails together in camera space. Segment long
  // rails so the far railing cannot paint over the entire flight at an angle.
  mesh.rails.forEach((rail,ri)=>{
    for(let i=1;i<rail.length;i++){
      const a=rail[i-1],b=rail[i],count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/14));
      const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
      for(let j=0;j<count;j++){
        const p=at(j/count),q=at((j+1)/count),d=(depth(p)+depth(q))/2;
        surfaces.push({kind:'side',p,q,depth:d-.001,key:`side-${ri}-${i}-${j}`},{kind:'rail',p,q,depth:d+.001,key:`rail-${ri}-${i}-${j}`});
      }
    }
    const posts=rail.length>10?rail.filter((_,j)=>j%9===0||j===rail.length-1):rail;
    posts.forEach((p,i)=>surfaces.push({kind:'post',p,depth:depth(p)+.002,key:`post-${ri}-${i}`}));
  });
  surfaces.sort((a,b)=>a.depth-b.depth);
  return <g className={`stair-art stair-decorated stair-${mesh.kind}`} data-perspective="three-quarter" stroke="#817951" strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
    <defs><filter id={id} filterUnits="userSpaceOnUse" x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="2.5"/></filter></defs>
    <path className="stair-ground-shadow" d={path(mesh.footprint)} transform={`translate(${3*Math.cos(r)+6*Math.sin(r)} ${-3*Math.sin(r)+6*Math.cos(r)})`} fill="#596344" opacity=".17" stroke="none" filter={`url(#${id})`}/>
    {surfaces.map(surface=>{
      const {kind,p,q,key}=surface;
      if(kind==='side')return <path key={key} className="stair-stringer" d={path([raised(p,p.z),raised(q,q.z),q,p])} fill="#b49a73" stroke="#97835f"/>;
      if(kind==='post')return <g key={key} fill="none"><path className="stair-rail-post" d={path([raised(p,p.z),raised(p,p.z+12)],false)} stroke="#899476" strokeWidth="2"/><path d={path([raised(p,p.z+1),raised(p,p.z+11)],false)} stroke="#dce1bf" strokeWidth=".55"/></g>;
      if(kind==='rail')return <g key={key} className="stair-railing" fill="none"><path className="stair-handrail-shadow" d={path([raised(p,p.z+10),raised(q,q.z+10)],false)} stroke="#596344" strokeWidth="3.6" opacity=".14"/><path className="stair-handrail" d={path([raised(p,p.z+12),raised(q,q.z+12)],false)} stroke="#788569" strokeWidth="3"/><path d={path([raised(p,p.z+12.4),raised(q,q.z+12.4)],false)} stroke="#d8dfba" strokeWidth=".85"/></g>;
      const step=surface.step;
      return <g key={`step-${surface.i}`} className="stair-step" data-elevation={step.z}>
      {step.points.map((p,i)=>{const q=step.points[(i+1)%step.points.length];
        // Test camera-space X after rotating the plan, not local X.
        if(Math.abs((p.x-q.x)*Math.cos(r)-(p.y-q.y)*Math.sin(r))<.001)return null;
        return <path key={i} className="stair-riser" d={path([raised(p,step.z),raised(q,step.z),raised(q,step.z-2),raised(p,step.z-2)])} fill="#b99b71"/>;
      })}
      <path className="stair-tread" d={path(step.points.map(p=>raised(p,step.z)))} fill={surface.i%2?'#e1c89e':'#e8d3ae'}/>
      <path className="stair-tread-nosing" d={path([step.points[0],step.points[step.points.length-1]].map(p=>raised(p,step.z)),false)} fill="none" stroke="#f6e9c9" strokeWidth="1.1"/>
    </g>;
    })}
  </g>;
}

/** Bold, unfilled 24px toolbar glyph, using the same footprint as the object. */
export function StairGlyph({kind='straight',sideways=false}) {
  if(sideways)return <svg className="stair-glyph stair-glyph-sideways" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20v-5h5v-5h5V5h7v15Z"/></svg>;
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
export function StairObject({stair,decorated=false,onPointerDown,selected=false,onResize,destinationLevel}) {
  const b=stairBounds(stair,{decorated}),mesh=stairGeometry(stair);
  const scale=Number.isFinite(stair?.scale)&&stair.scale>0?stair.scale:1;
  const rotation=finite(stair?.rotation,0),raised=(p,z)=>projectStairPoint(p,z,rotation);
  const landing=mesh.steps.at(-1),top=landing?.points.reduce((a,p)=>({x:a.x+p.x/landing.points.length,y:a.y+p.y/landing.points.length}),{x:0,y:0});
  const label=top&&raised(top,landing.z);
  return <g className={`stair-object${selected?' selected':''}`} data-stair-id={stair?.id} transform={`translate(${finite(stair?.x,0)} ${finite(stair?.y,0)}) rotate(${finite(stair?.rotation,0)}) scale(${scale})`} onPointerDown={e=>onPointerDown?.(e,stair)}>
    <path className="stair-hit-area" d={path(mesh.footprint)} fill="transparent" stroke="none" pointerEvents="all"/>
    {decorated&&<rect className="stair-raised-hit-area" {...b} fill="transparent" stroke="none" pointerEvents="all"/>}
    <StairArt stair={stair} decorated={decorated}/>
    {decorated&&destinationLevel&&landing&&<g className="stair-destination" pointerEvents="none">
      <path d={path(landing.points.map(p=>raised(p,landing.z)))} fill="#f3e6c9" fillOpacity=".35" stroke="#6f805d" strokeWidth="1.5"/>
      <g transform={`translate(${label.x} ${label.y}) rotate(${-rotation})`}><text y="-17" textAnchor="middle" fontSize="9" fill="#526b41" paintOrder="stroke" stroke="#f8f5e5" strokeWidth="3" strokeLinejoin="round">To Level {destinationLevel}</text></g>
    </g>}
    {selected&&<g className="stair-selection" fill="none" stroke={GREEN} strokeWidth="1.2">
      <rect {...b} fill="none" strokeDasharray="4 3" pointerEvents="none"/>
      {onResize&&[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y],i)=><g key={i} className="stair-resize-handle" onPointerDown={e=>{e.stopPropagation();onResize(e,stair);}} style={{cursor:gameCursor(i%2===0?'nwse-resize':'nesw-resize')}}>
        <rect x={x-5} y={y-5} width="10" height="10" fill="transparent" stroke="none" pointerEvents="all"/>
        <rect x={x-3} y={y-3} width="6" height="6" fill="none" pointerEvents="none"/>
      </g>)}
    </g>}
  </g>;
}

// View the flight from the upper floor's elevation, not from the ground below.
// The terminal tread is flush with this floor; earlier treads descend into the
// opening. Keep the projected flight clipped to its real plan footprint.
export function StairArrival({stair,fromLevel}){
  const id='stairwell-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const mesh=stairGeometry(stair),landing=mesh.steps.at(-1);if(!landing)return null;
  const rotation=finite(stair.rotation,0),project=(p,z)=>projectStairPoint(p,z-landing.z,rotation);
  const sorted=mesh.steps.map((step,i)=>({...step,i,depth:step.points.reduce((sum,p)=>sum+stairScreenDepth(p,rotation),0)/step.points.length})).sort((a,b)=>a.depth-b.depth||a.i-b.i);
  return <g className="stair-arrival" data-perspective="descending" role="img" aria-label={`Stairs from Level ${fromLevel}`} transform={`translate(${stair.x} ${stair.y}) rotate(${stair.rotation||0}) scale(${stair.scale||1})`} pointerEvents="none" strokeLinecap="round" strokeLinejoin="round">
    <title>Stairs from Level {fromLevel}</title>
    <defs><clipPath id={id}><path d={path(mesh.footprint)}/></clipPath></defs>
    <g clipPath={`url(#${id})`}>
      <path className="stairwell-depth" d={path(mesh.footprint)} fill="#69735b"/>
      {sorted.map(step=><g key={step.i} className="stair-descending-step" data-depth={landing.z-step.z}>
        {step.points.map((p,i)=>{const q=step.points[(i+1)%step.points.length];return <path key={i} d={path([project(p,step.z),project(q,step.z),project(q,step.z-2),project(p,step.z-2)])} fill="#a68d67" stroke="#817951" strokeWidth=".7"/>;})}
        <path d={path(step.points.map(p=>project(p,step.z)))} fill={step.i%2?'#dfc69d':'#ead4ae'} stroke="#817951" strokeWidth=".9"/>
        <path className="stairwell-tread-shade" d={path(step.points.map(p=>project(p,step.z)))} fill="#354632" opacity={.42*(1-step.z/landing.z)}/>
      </g>)}
      <path className="stair-arrival-landing" d={path(landing.points)} fill="#ead4ae" stroke="#817951" strokeWidth="1.1"/>
    </g>
    {/* Side rails leave the exit end open. There is no floating level label
        across the upper wall; the source is available on hover/accessibly. */}
    {mesh.rails.map((rail,i)=><g key={i} className="stairwell-guardrail" fill="none" stroke="#788569">
      {[rail[0],rail.at(-1)].map((p,j)=><path key={j} d={path([p,projectStairPoint(p,6,rotation)],false)} strokeWidth="1.5"/>)}
      <path d={path(rail.map(p=>projectStairPoint(p,6,rotation)),false)} strokeWidth="2"/>
    </g>)}
    <path className="stairwell-hover-hit" d={path(mesh.footprint)} fill="transparent" stroke="none" pointerEvents="all"/>
  </g>;
}
