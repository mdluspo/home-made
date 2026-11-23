import React,{useId,useMemo} from 'react';
import {Character} from './Art.jsx';
import { floorOutlines, furnitureFootprint, furnitureVisualBounds } from './model.js';
import {buildRoomWalls,openingOccluders,wallGeometryPath} from './roomWalls.js';
import {LevelLabels} from './LevelLabels.jsx';
import {StairObject} from './Stairs.jsx';
import clipping from 'polygon-clipping';

const pathOf=points=>'M'+points.map(p=>`${p.x},${p.y}`).join(' L');
// Height always rises in screen Y; rotating a wall never rotates its verticals.
const openingPoint=(o,x,z=0,angle=o.angle||0)=>({x:o.x+x*Math.cos(angle*Math.PI/180),y:o.y+x*Math.sin(angle*Math.PI/180)-z});
const openingFace=(o,left,right,bottom,top)=>pathOf([openingPoint(o,left,bottom),openingPoint(o,right,bottom),openingPoint(o,right,top),openingPoint(o,left,top)])+' Z';
const sideOpening=o=>Math.abs(Math.cos((o.angle||0)*Math.PI/180))<.15;
const openingHalf=o=>o.type==='window'?(o.windowSpan||42)/2:20;
const windowDivisionCount=o=>{
  const count=o.windowCount||1;
  if(count<=1)return 0;
  if(count===4)return 2;
  return Math.min(count-1,Math.max(2,Math.ceil((o.windowSpan||42)/55)-1));
};
const windowDivisions=o=>Array.from({length:windowDivisionCount(o)},(_,i)=>-openingHalf(o)+(i+1)*(openingHalf(o)*2)/(windowDivisionCount(o)+1));
const openingBand=(o,left,right,z,half)=>{
  const angle=(o.angle||0)*Math.PI/180,nx=-Math.sin(angle)*half,ny=Math.cos(angle)*half;
  const a=openingPoint(o,left,z),b=openingPoint(o,right,z);
  return pathOf([{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}])+' Z';
};
function SideDoor({opening:o,onDoor,mask,leafMask}){
  const h=o.height,half=o.thickness/2,hinge=openingPoint(o,-20);
  const leaf={...o,...hinge,angle:(o.angle||0)+(o.open?70:0)};
  const jamb=along=>{
    const across={...o,...openingPoint(o,along),angle:(o.angle||0)+90};
    return <g key={along} className="side-door-jamb"><path d={openingFace(across,-half,half,0,o.height)} fill="#eee9d3" stroke="#748164" strokeWidth="1.3"/><path d={openingBand(o,along-1.5,along+1.5,o.height,half)} fill="#f2efdb" stroke="#748164" strokeWidth="1.3"/></g>;
  };
  const back=Math.sin((o.angle||0)*Math.PI/180)>0?-22:22;
  return <g className="topdown-opening topdown-door side-opening" data-wall-height={o.height} data-plan-angle={o.angle||0} onPointerDown={e=>{e.stopPropagation();onDoor?.(o);}}>
    <g clipPath={mask} className="side-door-frame">{jamb(back)}</g>
    <g clipPath={leafMask} className="door-leaf side-door" data-plan-angle={leaf.angle}>
      {o.open&&<path d={openingFace(leaf,0,40,0,h)} fill="#cdb58b" stroke="#827a5c" strokeWidth="1.3"/>}
      <path className="side-door-top" d={openingBand(leaf,0,40,h,1.7)} fill="#d8c29a" stroke="#827a5c" strokeWidth="1.2"/>
    </g>
    <g clipPath={mask}><path d={openingBand(o,-20,20,0,half)} fill="#c1ae87" stroke="#938565" strokeWidth="1"/></g>
    <g clipPath={mask} className="side-door-frame">{jamb(-back)}</g>
  </g>;
}
function DoubleDoor({opening:o,onDoor,mask,leafMask}){
  const height=o.height,doorHeight=Math.max(8,height-9),half=(o.doorSpan||84)/2;
  return <g className="topdown-opening topdown-door double-door" data-wall-height={height} onPointerDown={e=>{e.stopPropagation();onDoor?.(o);}}>
    <g clipPath={mask}><path d={openingFace(o,-half,half,0,doorHeight)} fill="none" stroke="#7c8164" strokeWidth="2"/></g>
    {[-1,1].map((side,i)=>{
      const hinge=openingPoint(o,side*half),length=-side*half;
      const leaf={...o,...hinge,angle:(o.angle||0)+(o.open?-side*70:0)};
      const knob=openingPoint(leaf,length*.84,doorHeight*.45);
      return <g key={side} className={side<0?'double-door-leaf-left':'double-door-leaf-right'} clipPath={`${leafMask.slice(0,-1)}-${i})`} data-plan-angle={leaf.angle}>
        {height>18&&<><path className="door-leaf double-door-leaf" d={openingFace(leaf,0,length,0,doorHeight)} fill="#c4a274" stroke="#827b5a" strokeWidth="1.7"/>
          <path d={openingFace(leaf,length*.12,length*.88,7,doorHeight-6)} fill="none" stroke="#a78d65" strokeWidth="1"/>
          <circle cx={knob.x} cy={knob.y} r="1.6" fill="#ecdaa5" stroke="#8e8058" strokeWidth=".7"/></>}
        <path className="double-door-top" d={openingBand(leaf,0,length,height>18?doorHeight:0,1.7)} fill="#d8c29a" stroke="#827b5a" strokeWidth="1.2"/>
      </g>;
    })}
  </g>;
}
function RoomOpening({opening:o,height,onDoor,mask,leafMask,portalClip}){
  const upright=height>18,doorHeight=Math.max(8,height-9);
  if(o.type==='door'&&o.doorSpan>42)return <DoubleDoor opening={o} onDoor={onDoor} mask={mask} leafMask={leafMask}/>;
  const hinge=openingPoint(o,-20),leafAngle=(o.angle||0)+(o.open?70:0);
  const leaf={...o,x:hinge.x,y:hinge.y,angle:leafAngle};
  if(sideOpening(o)&&o.type==='door'&&upright)return <SideDoor opening={o} onDoor={onDoor} mask={mask} leafMask={leafMask}/>;
  if(sideOpening(o)&&o.type==='window')return <g clipPath={mask} className="topdown-opening topdown-window side-opening" data-wall-height={height} data-plan-angle={o.angle||0}>
    <path className="side-window-pane" d={openingBand(o,-openingHalf(o),openingHalf(o),height,o.thickness/2-1)} fill="#dbe9df" stroke="#81927b" strokeWidth="1.5"/>
    <path d={pathOf([openingPoint(o,-openingHalf(o)+1,height),openingPoint(o,openingHalf(o)-1,height)])} stroke="#f5faee" strokeWidth="1.2"/>
    {[-openingHalf(o)-2,openingHalf(o)+2].map(along=><path key={along} d={openingBand(o,along-1,along+1,height,o.thickness/2)} fill="#eee9d3" stroke="#748164" strokeWidth="1.3"/>)}
  </g>;
  return <g className={`topdown-opening topdown-${o.type}`} data-wall-height={height} onPointerDown={e=>{e.stopPropagation();if(o.type==='door')onDoor?.(o);}}>
    {o.type==='door'&&<g clipPath={mask}><g transform={`translate(${o.x} ${o.y}) rotate(${o.angle||0})`}>
      <path d="M-23-7v14m46-14v14" stroke="#6f7c5e" strokeWidth="2.5"/>
    </g></g>}
    {o.type==='window'?<g clipPath={mask}>{upright?<>
      <path className="wall-window-pane" d={openingFace(o,-openingHalf(o),openingHalf(o),13,height-10)} fill="#dbe9df" stroke="#81927b" strokeWidth="2.5"/>
      <path d={pathOf([openingPoint(o,-openingHalf(o),12),openingPoint(o,openingHalf(o),12)])} stroke="#f5efd9" strokeWidth="4"/>
      <path d={pathOf([openingPoint(o,-openingHalf(o)+2,19),openingPoint(o,openingHalf(o)-3,height-14)])} stroke="#f7fbef" strokeWidth="1.2"/>
      {windowDivisions(o).map(along=><path key={along} d={pathOf([openingPoint(o,along,13),openingPoint(o,along,height-10)])} stroke="#81927b" strokeWidth="1.8"/>)}
    </>:<>
      <path className="low-window-pane" d={openingBand(o,-openingHalf(o),openingHalf(o),0,Math.max(4,o.thickness/2-1))} fill="#dbe9df" stroke="#81927b" strokeWidth="1.5"/>
      <path d={pathOf([openingPoint(o,-openingHalf(o),0),openingPoint(o,openingHalf(o),0)])} stroke="#f5efd9" strokeWidth="4"/>
    </>}</g>:upright?<>
      <g clipPath={mask}>
      <path d={openingFace(o,-22,22,0,doorHeight+1)} fill="none" stroke="#7c8164" strokeWidth="2"/>
      </g>
      <g clipPath={leafMask}>
      <g clipPath={portalClip}>
      <path className="door-leaf upright-door" d={openingFace(leaf,0,40,0,doorHeight)} fill="#c4a274" stroke="#827b5a" strokeWidth="1.7"/>
      <path d={openingFace(leaf,5,35,7,doorHeight-6)} fill="none" stroke="#a78d65" strokeWidth="1"/>
      <circle {...(()=>{const p=openingPoint(leaf,33,doorHeight*.45);return {cx:p.x,cy:p.y};})()} r="1.7" fill="#ecdaa5" stroke="#8e8058" strokeWidth=".7"/>
      </g>
      </g>
    </>:<g clipPath={mask}><g transform={`translate(${o.x} ${o.y}) rotate(${o.angle||0})`}>
      <path d="M-21 0h42" stroke="#aa956f" strokeWidth="2"/>
      <g className="door-leaf" transform={o.open?'translate(-20 0) rotate(70)':'translate(-20 0)'}><path d="M0-3.5 40-3 40 4 0 3.5Z" fill="#c4a274" stroke="#7e795a" strokeWidth="1.5"/><path d="M31-4v4" stroke="#efe1af" strokeWidth="2.5"/></g>
    </g></g>}
  </g>;
}

export function TopDownRoom({home,onDoor,onStairDown,showLabels=true,floorVoids=[]}){
  const maskId=`room-opening-depth-${useId().replace(/:/g,'')}`;
  const mesh=useMemo(()=>buildRoomWalls(home),[home.boundary,home.outlines,home.holes,home.walls,home.openings]);
  // buildRoomWalls already normalizes adjacent windows into one span. Reusing
  // that list here keeps the decorated pane identical to the floor-plan cutout.
  const openings=useMemo(()=>mesh.openings.map(o=>({...o,occlusion:wallGeometryPath(openingOccluders(mesh,o)),leafOcclusion:wallGeometryPath(openingOccluders(mesh,o,{leaf:true})),pairedLeafOcclusions:o.doorSpan>42?[-1,1].map(side=>wallGeometryPath(openingOccluders(mesh,o,{leaf:true,hingeAlong:side*o.doorSpan/2,leafLength:-side*o.doorSpan/2,swing:-side*70}))):[]})),[mesh]);
  if(!home.boundary.length)return null;
  const outline=floorVoids.length?wallGeometryPath(clipping.difference(floorOutlines(home).map(r=>[r.map(p=>[p.x,p.y])]),...[...(home.holes||[]),...floorVoids].map(r=>[r.map(p=>[p.x,p.y])]))):[...floorOutlines(home),...(home.holes||[])].map(r=>pathOf(r)+' Z').join(' ');
  const floor={oak:'#d8b98c',birch:'#e9d5ae',tile:'#bdc9ad',rose:'#c3a092'}[home.floor];
  return <g className="topdown-room" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <pattern id={`${maskId}-floorboards`} width="80" height="28" patternUnits="userSpaceOnUse">
        <rect width="80" height="28" fill={floor}/>
        <path d={home.floor==='tile'?'M0 0H80V28H0ZM40 0v28':'M0 0H80V28H0M40 0v14M0 14h80M16 14v14M62 14v14'} fill="none" stroke="#957b59" strokeWidth=".75" opacity=".42"/>
        {home.floor!=='tile'&&<path d="M6 6h22m22 3h17M24 21h23" stroke="#fff6df" strokeWidth=".9" opacity=".24"/>}
      </pattern>
      {openings.flatMap((o,i)=>[false,true].map(leaf=><clipPath key={`${o.id}-${leaf}`} id={`${maskId}-${i}${leaf?'-leaf':''}`} clipPathUnits="userSpaceOnUse">
        <path className="opening-visible-region" d={`M-10000-10000H10000V10000H-10000Z ${leaf?o.leafOcclusion:o.occlusion}`} clipRule="evenodd"/>
      </clipPath>))}
      {openings.flatMap((o,i)=>o.pairedLeafOcclusions.map((occlusion,j)=><clipPath key={`${o.id}-pair-${j}`} id={`${maskId}-${i}-leaf-${j}`} clipPathUnits="userSpaceOnUse"><path d={`M-10000-10000H10000V10000H-10000Z ${occlusion}`} clipRule="evenodd"/></clipPath>))}
      {openings.filter(o=>o.type==='door'&&!sideOpening(o)&&o.height>18).map(o=><clipPath key={`${o.id}-portal`} id={`${maskId}-${openings.indexOf(o)}-portal`} clipPathUnits="userSpaceOnUse"><path className="doorway-leaf-limit" d={openingFace(o,-21,21,0,o.height-8)}/></clipPath>)}
    </defs>
    <path className="topdown-floor" d={outline} fill={`url(#${maskId}-floorboards)`} fillRule="evenodd"/>
    {floorVoids.map((ring,i)=><path key={i} className="stairwell-rim" d={pathOf(ring)+' Z'} fill="none" stroke="#879577" strokeWidth="3" pointerEvents="none"/>)}
    {(home.stairs||[]).map(s=><StairObject key={s.id} stair={s} decorated onPointerDown={onStairDown}/>)}
    <g className="topdown-walls" pointerEvents="none">
      <g className="wall-faces" fill={home.wallColor}>
        {mesh.surfaces.filter(s=>s.kind==='face'&&!s.rimReturn).map((surface,i)=><path key={i} className="wall-face" data-height={surface.height} d={wallGeometryPath(surface.geometry)} fillRule="evenodd"/>)}
      </g>
      <g className="wall-caps" fill="#f2efdb">
        {mesh.surfaces.filter(s=>s.kind==='cap').map((surface,i)=><path key={i} className="joined-wall-cap" data-height={surface.height} d={wallGeometryPath(surface.geometry)} fillRule="evenodd"/>)}
        <path className="continuous-wall-rim" d={wallGeometryPath(mesh.rim)} fillRule="evenodd" stroke="#748164" strokeWidth="1.5"/>
      </g>
      <path className="wall-silhouette" d={wallGeometryPath(mesh.silhouette)} fill="none" stroke="#748164" strokeWidth="1.6"/>
    </g>
    {[...openings].sort((a,b)=>a.y-b.y).map(o=>{const id=`${maskId}-${openings.indexOf(o)}`;return <g key={o.id} className="depth-sorted-opening" data-plan-depth={o.y}><RoomOpening opening={o} height={o.height} onDoor={onDoor} mask={`url(#${id})`} leafMask={`url(#${id}-leaf)`} portalClip={`url(#${id}-portal)`}/></g>;})}
    {showLabels&&<LevelLabels home={home} raised/>}
  </g>;
}

// RPG-style three-quarter overhead art: axes stay square to the room, while
// height is drawn upward to show fronts as well as tops. No isometric skew.
export function TopDownFurniture({type,custom}){
  const [w,h]=furnitureFootprint(type),x=-w/2,y=-h/2;
  const box=(fill,rx=3)=><rect x={x} y={y} width={w} height={h} rx={rx} fill={fill}/>;
  const face=(fill,top,height,left=x,width=w)=><rect className="sprite-front-face" x={left} y={top} width={width} height={height} rx="1" fill={fill}/>;
  const feet=(spread=w/2-8,top=h/2-2)=><path d={`M${-spread} ${top}v8m${spread*2} -8v8`} stroke="#8c7353" strokeWidth="4"/>;
  let art;
  switch(type){
    case 'sofa':art=<>
      {feet()}{face('#8e9f77',y+h-15,18)}
      <rect x={x+5} y={y} width={w-10} height={h-12} rx="4" fill="#c0cba7"/>
      <rect x={x} y={y-18} width={w} height="23" rx="4" fill="#a6b78f"/>
      <path d={`M${x+6} ${y-12}q42-2 ${w-12} 0M0 ${y-15}v16M0 ${y+9}v${h-24}`} fill="none" stroke="#879b73"/>
      <rect x={x+1} y={y-1} width="11" height={h+3} rx="3" fill="#aaba93"/>
      <rect x={w/2-12} y={y-1} width="11" height={h+3} rx="3" fill="#aaba93"/>
      <path d={`M${x+3} ${y+7}h7m${w-20} 0h7`} stroke="#d1d9b9"/>
      <path d={`m${x+18} ${y+8} 16-2 2 18-17 2Z`} fill="#e5cd98"/>
      <path d={`m${w/2-35} ${y+7} 17 2-2 17-17-2Z`} fill="#eee4cc"/>
    </>;break;
    case 'chair':art=<>
      {feet(w/2-6,h/2-2)}{face('#b7956c',3,20,x+3,w-6)}
      <rect x={x+2} y={y-15} width={w-4} height="24" rx="4" fill="#caa679"/>
      <rect x={x+6} y={y-10} width={w-12} height="15" rx="2" fill="#e3c795"/>
      <path d={`M${x+8} ${y-5}h${w-16}m-${w-16} 5h${w-16}`} stroke="#bc9c6e"/>
      <rect x={x+6} y="-10" width={w-12} height="23" rx="3" fill="#e4c694"/>
      <path d={`M${x} -9v26m${w} -26v26`} stroke="#c3a272" strokeWidth="6"/>
    </>;break;
    case 'bed':art=<>
      {feet(w/2-5,h/2-1)}{face('#b49770',h/2-8,13)}
      <rect x={x} y={y-12} width={w} height="21" rx="3" fill="#bda27c"/>
      <path d={`M${x+6} ${y-6}h${w-12}`} stroke="#e0c99f"/>
      <rect x={x+4} y={y+2} width={w-8} height={h-9} rx="5" fill="#f0e9d5"/>
      <rect x={x+9} y={y+7} width={w/2-12} height="21" rx="4" fill="#faf5e5"/>
      <rect x="3" y={y+7} width={w/2-12} height="21" rx="4" fill="#faf5e5"/>
      <path d={`M${x+4} ${y+34}q35 4 ${w-8} 0v${h-40}H${x+4}Z`} fill="#b9c5a0"/>
      <path d={`M${x+7} ${y+41}q30 4 ${w-14} 0M${x+12} ${h/2-13}h${w-24}`} fill="none" stroke="#94a37d"/>
      <path d={`M${x+3} ${h/2-1}h${w-6}`} stroke="#b69a70" strokeWidth="5"/>
    </>;break;
    case 'table':art=<>
      {feet(w/2-12,5)}<path d="M-6 9v18m22-18v15" stroke="#a78a64" strokeWidth="4"/>
      <ellipse className="sprite-front-face" cy="-5" rx={w/2} ry={h/2-7} fill="#b79970"/>
      <ellipse cy="-12" rx={w/2} ry={h/2-7} fill="#dfc399"/>
      <path d="M-23-19q24-8 44 0M-20-4q22 5 40-1" stroke="#bca077" fill="none"/>
      <rect x="-15" y="-25" width="16" height="18" transform="rotate(-8)" fill="#eae3c7"/>
      <ellipse cx="13" cy="-9" rx="8" ry="5" fill="#f8efd7"/>
      <path d="M7-11v-8q6-4 12 0v8q-6 5-12 0m12-7q8-1 5 6h-5" fill="#eee1bf" strokeWidth="1.2"/>
      <ellipse cx="13" cy="-19" rx="6" ry="2.5" fill="#a48a63"/>
    </>;break;
    case 'shelf':art=<>
      {feet(w/2-6,h/2-3)}{face('#bc9a71',y-39,h+39)}
      <rect x={x+4} y={y-35} width={w-8} height={h+29} fill="#e2cba1"/>
      {[y-33,y-13,y+7].map((row,r)=><g key={r}>{Array.from({length:11},(_,i)=><rect key={i} x={x+7+i*7} y={row+(i%3)} width="5" height={12-i%2} fill={['#9eaf94','#d5bf91','#8fa89e','#baa08a'][(i+r)%4]} strokeWidth=".65"/>)}<path d={`M${x+4} ${row+15}h${w-8}`} stroke="#ad8d64" strokeWidth="3"/></g>)}
      <rect x={x} y={y-50} width={w} height="13" rx="1" fill="#d7bb90"/>
      <path d={`M${x+7} ${y-45}h${w-14}`} stroke="#e7d1aa" strokeWidth="1"/>
    </>;break;
    case 'cabinet':case 'nightstand':{
      const rise=type==='cabinet'?16:12,top=y-rise,split=y+3;
      art=<>{feet(w/2-5,h/2-2)}{face('#b99770',split,h/2-split)}
        <rect x={x} y={top} width={w} height={rise+3} rx="2" fill="#d9be94"/>
        <path d={`M${x+5} ${top+5}h${w-10}`} stroke="#ead6ae"/>
        <path d={`M0 ${split+2}v${h/2-split-4}`} stroke="#917951"/>
        {[-1,1].map(side=><rect key={side} x={side<0?-w/2+4:3} y={split+4} width={w/2-7} height={Math.max(5,h/2-split-9)} rx="1" fill="#c7a77e" strokeWidth=".9"/>)}
        <path d="M-5 2v3m10-3v3" stroke="#ede0b2" strokeWidth="2"/>
      </>;break;
    }
    case 'plant':case 'fern':art=<>
      <path className="sprite-front-face" d="M-12-4-9 14q9 6 18 0l3-18" fill="#c5a47b"/>
      <ellipse cy="-4" rx="13" ry="5" fill="#dfc399"/><ellipse cy="-4" rx="9" ry="3" fill="#8b7c57"/>
      <g transform={`translate(0 ${type==='fern'?-12:-18})`}>
        {Array.from({length:type==='fern'?10:7},(_,i)=><g key={i} transform={`rotate(${i*(type==='fern'?36:51.4)})`}><path d="M0 3Q-15-5-5-18 8-16 0 3Z" fill={i%2?'#8fa676':'#a4b987'} strokeWidth="1.2"/><path d="M0 1-4-13" fill="none" stroke="#6e895c" strokeWidth=".8"/></g>)}
        <circle r="3" fill="#899c6c"/>
      </g>
    </>;break;
    case 'rug':art=<>{box('#b6c293',12)}<rect x={x+6} y={y+6} width={w-12} height={h-12} rx="9" fill="none" stroke="#dce0b7" strokeWidth="2"/>{[-1,1].map(side=><path key={side} d={Array.from({length:10},(_,i)=>`M${side*w/2} ${y+8+i*9}h${side*5}`).join('')} stroke="#b6c293" strokeWidth="1.3"/>)}</>;break;
    case 'lamp':art=<>
      <ellipse cy="9" rx="11" ry="4" fill="#b5a47a"/><path d="M0 8v-44" stroke="#8f9470" strokeWidth="3"/>
      <path className="sprite-front-face" d="M-11-47-17-27q17 7 34 0l-6-20Z" fill="#e8cd92"/>
      <ellipse cy="-47" rx="11" ry="5" fill="#f2dfad"/><path d="M-7-42-10-30m17-12 3 12" stroke="#cdb37b" strokeWidth="1"/>
      <ellipse cy="-27" rx="17" ry="4" fill="#eddaaa"/>
    </>;break;
    case 'stove':art=<>
      {face('#8f9e90',-7,h/2+7)}<rect x={x} y={y-14} width={w} height="32" rx="2" fill="#dce0d0"/>
      {[[-11,-30],[11,-30],[-11,-16],[11,-16]].map(([cx,cy],i)=><g key={i}><ellipse cx={cx} cy={cy} rx="7" ry="4" fill="#7b826e"/><ellipse cx={cx} cy={cy} rx="3.5" ry="2" fill="none" stroke="#d7ddc8" strokeWidth="1"/></g>)}
      <rect x={x+5} y="5" width={w-10} height="14" rx="2" fill="#697c71"/>
      <path d={`M${x+8} 3h${w-16}`} stroke="#d5c398" strokeWidth="2"/>
      {[-15,-5,5,15].map(cx=><circle key={cx} cx={cx} cy="-2" r="1.6" fill="#eee4c7" strokeWidth=".6"/>)}
    </>;break;
    case 'fridge':art=<>
      {face('#9daf96',y-30,h+30)}<rect x={x} y={y-44} width={w} height="14" rx="2" fill="#c2ceb0"/>
      <path d={`M${x+3} ${y-7}h${w-6}M${x+6} ${y-23}v11m0 14v19`} fill="none" stroke="#63795b" strokeWidth="2.2"/>
      <path d={`M${w/2-4} ${y-26}v${h+24}`} stroke="#c2ceb0" strokeWidth="1"/>
      <rect x="3" y={y-20} width="10" height="9" transform="rotate(5)" fill="#e5d499" strokeWidth=".8"/>
    </>;break;
    case 'art':art=<>
      {face('#b99c72',y-12,h+12)}<rect x={x+4} y={y-8} width={w-8} height={h+4} fill="#e8ddba"/>
      <circle cx="8" cy="-11" r="4" fill="#d8b771"/><path d="m-15 8 10-15 9 10 7-6 6 11" fill="#9eaf88" strokeWidth="1"/>
    </>;break;
    case 'books':art=<>
      <rect className="sprite-front-face" x={x+1} y="1" width={w-2} height="9" rx="1" fill="#e8dfbf"/>
      <path d={`M${x+2} 5h${w-4}M${x+3} 8h${w-6}`} stroke="#c4b794" strokeWidth=".8"/>
      <rect x={x} y="-2" width={w} height="5" rx="1" fill="#ad9479"/>
      <rect x={x+2} y="-10" width={w-3} height="10" rx="1" fill="#a0b09b" transform="rotate(-7)"/>
      <path d="M-6-6H7" stroke="#e4dfc1" strokeWidth="1"/>
    </>;break;
    case 'kettle':art=<>
      <path className="sprite-front-face" d="M-10-15q-5 11-1 22 11 7 22 0 4-11-1-22Z" fill="#d9c18f"/>
      <path d="M-8-13q-3-18 11-12 6 2 5 12" fill="none" stroke="#8d8d68" strokeWidth="2.5"/>
      <ellipse cy="-14" rx="9" ry="4" fill="#e8d4a7"/><ellipse cy="-17" rx="3" ry="2" fill="#ab9163"/>
      <path d="M9-6 17-12 13 1" fill="#e8d4a7"/>
    </>;break;
    case 'mirror':art=<>
      <path d="M-12 1-15 8m27-7 3 7" stroke="#a58b66" strokeWidth="3"/>
      <rect className="sprite-front-face" x={x+2} y="-50" width={w-4} height="54" rx="14" fill="#bda079"/>
      <rect x={x+6} y="-46" width={w-12} height="45" rx="11" fill="#d2e3db"/>
      <path d="m-8-17 13-18m-11 25 13-18" stroke="#f2f6e9" strokeWidth="1.3"/>
    </>;break;
    case 'cat':art=<>
      <ellipse className="sprite-front-face" cy="1" rx="15" ry="10" fill="#d7b88c"/>
      <path d="M-15-7-16-17-8-13-1-16 1-6" fill="#d7b88c"/>
      <ellipse cx="-7" cy="-6" rx="8" ry="7" fill="#e3c89f"/>
      <path d="M-12-7h2m5 0h2m-5 4 1 1 1-1" fill="none" strokeWidth="1"/>
      <path d="M8-6q15 4 3 11-9 5-8-1" fill="none" stroke="#b6956e" strokeWidth="3"/>
    </>;break;
    default:art=custom?<image href={custom.src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet"/>:box('#c9cbb1');
  }
  return <g className={`topdown-furniture sprite-${type}`} data-perspective={custom?'sticker':'three-quarter'} stroke="#69755c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {type!=='rug'&&!custom&&<ellipse className="sprite-ground-shadow" cy={h/2+2} rx={w*.47} ry="4" fill="#596344" opacity=".13" stroke="none"/>}
    {art}
  </g>;
}

export function TopDownPreview({type,custom}){
  const b=furnitureVisualBounds(type),size=Math.max(b.width,b.height)+12,cx=b.x+b.width/2,cy=b.y+b.height/2;
  return <svg className="topdown-preview" viewBox={`${cx-size/2} ${cy-size/2} ${size} ${size}`} aria-hidden="true"><TopDownFurniture type={type} custom={custom}/></svg>;
}
export function TopDownCharacter({x,y,color='#9cae80'}){
  return <Character x={x} y={y} color={color} className="topdown-character"/>;
}

export function FurnitureSelection({item,onResize}){
  const b=furnitureVisualBounds(item.type),x=b.x-3,y=b.y-3,w=b.width+6,h=b.height+6;
  return <g stroke="#6c8755" strokeWidth="1.2"><rect x={x} y={y} width={w} height={h} className="selection-box" strokeDasharray="4 3" fill="none"/>{[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([cx,cy],i)=><rect key={i} x={cx-3} y={cy-3} width="6" height="6" fill="#fff9e8" className="resize-handle" onPointerDown={e=>onResize(e,item)}/>)}</g>;
}
