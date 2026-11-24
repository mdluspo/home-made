import React,{useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ChevronUp,ChevronDown,Grid2X2,Layers,Plus,Trash2,RotateCw} from 'lucide-react';
import {SketchFrame} from './SketchFrame.jsx';
import {floorDescriptors,floorHome,previousFloorBlueprint,stackLayers} from './floors.js';
import {FloorPlan} from './FloorPlan.jsx';
import {TopDownFurniture,TopDownRoom} from './TopDown.jsx';
import {stairPolygons,STAIR_TYPES} from './stairs.js';
import {StairArrival,StairObject} from './Stairs.jsx';
import {orderedObjects} from './layers.js';
import {floorOverhang} from './floorSupport.js';

export function FloorSupportNote({home,level}){
  const overhang=useMemo(()=>floorOverhang(home,level),[home,level]);
  if(!overhang)return null;
  const {floor,area}=overhang;
  return <g className="floor-support-note" pointerEvents="none" aria-label="Overhang design reminder">
    <title>This floor extends beyond Level {overhang.belowLevel}. Consider pillars or cantilever support. Visual design reminder only, not a structural assessment.</title>
    <text x={floor.x+floor.width/2} y={floor.y+floor.height+67} textAnchor="middle" fontSize="10" fill="#9b7b45" paintOrder="stroke" stroke="#fbfaf2" strokeWidth="3">Overhang {area.toFixed(1)} m² · consider support</text>
  </g>;
}

export function PreviousFloorBlueprint({home,level,draft}){
  const blueprint=useMemo(()=>previousFloorBlueprint(home,level,draft),[home,level,draft]);
  if(!blueprint)return null;
  return <g className="previous-floor-blueprint" data-source-level={blueprint.level} pointerEvents="none" opacity=".6" aria-label={`Level ${blueprint.level} footprint reference`}>
    <title>Level {blueprint.level} footprint — reference only</title>
    <path d={'M'+blueprint.ring.map(p=>`${p.x},${p.y}`).join(' L')+' Z'} fill="none" stroke="#829574" strokeWidth="2" strokeDasharray="3 6" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
  </g>;
}
export function BuildPlans({home,draftLevel,draft,...planProps}){
  const floors=useMemo(()=>floorDescriptors(home),[home]);
  return <g className="build-plans">
    {floors.length?floors.map(f=><FloorPlan key={f.level} {...planProps} home={floorHome(home,f)} showObjects={false} hideLevelLabels/>):<FloorPlan {...planProps} home={home} showObjects={false} hideLevelLabels/>}
  </g>;
}
function stairVoid(stair,offset){
  const r=(stair.rotation||0)*Math.PI/180,s=stair.scale||1;
  return stairPolygons(stair).map(ring=>ring.map(({x,y})=>({x:stair.x+offset.x+(x*Math.cos(r)-y*Math.sin(r))*s,y:stair.y+offset.y+(x*Math.sin(r)+y*Math.cos(r))*s})));
}
export function FloorStack({home,level,onDoor,onStairDown,externalObjects=false,showLabels=true}){
  const fogId=`floor-fog-${useId().replace(/:/g,'')}`;
  const {floors,active,adjacent,adjacentOffset}=useMemo(()=>stackLayers(home,level),[home,level]);
  const data=useMemo(()=>floorHome(home,active),[home,active]);
  const neighbor=useMemo(()=>adjacent?floorHome(home,adjacent):null,[home,adjacent]);
  if(!active)return null;
  const below=adjacent&&adjacent.level<active.level;
  const arrivals=below?(neighbor.stairs||[]).filter(s=>!s.toLevel||s.toLevel===active.level||!floors.some(f=>f.level===s.toLevel&&f.level>adjacent.level)):[];
  const voids=arrivals.flatMap(s=>stairVoid(s,adjacentOffset));
  const objects=(data,interactive=false)=>orderedObjects(data).map(({kind,object:o})=>kind==='stair'?<StairObject key={o.id} stair={o} decorated onPointerDown={interactive?onStairDown:undefined}/>:<g key={o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.rotation||0}) scale(${o.scale||1})`} opacity={o.opacity??1}><g transform={`scale(${o.flipped?-1:1} 1)`}><TopDownFurniture type={o.type} custom={home.custom.find(c=>c.id===o.type)}/></g></g>);
  return <g className="stacked-floors" data-active-level={active.level}>
    {below&&<g className="adjacent-floor adjacent-below" data-level={adjacent.level} opacity=".45" pointerEvents="none" transform={`translate(${adjacentOffset.x} ${adjacentOffset.y})`} filter={`url(#${fogId})`}>
      <defs><filter id={fogId} x="-10%" y="-20%" width="120%" height="140%"><feColorMatrix type="matrix" values=".6 .15 .05 0 .08 .1 .65 .08 0 .1 .1 .2 .45 0 .06 0 0 0 1 0"/><feGaussianBlur stdDeviation=".8"/></filter></defs>
      <TopDownRoom home={neighbor} showLabels={false} showStairs={false}/>
      {objects(neighbor)}
    </g>}
    <g className="active-floor" data-level={active.level}>
      <TopDownRoom home={data} floorVoids={voids} onDoor={onDoor} showStairs={false} showLabels={showLabels}>
        {arrivals.map(s=><StairArrival key={s.id} stair={{...s,x:s.x+adjacentOffset.x,y:s.y+adjacentOffset.y}} fromLevel={adjacent.level}/>)}
      </TopDownRoom>
      {!externalObjects&&objects(data,true)}
    </g>
  </g>;
}

export function FloorSwitcher({floors,level,onLevel,onNew,overview,onOverview,bounds,groupRef,workspaceRef,viewKey}){
  const ref=useRef(),[anchor,setAnchor]=useState(null);
  useLayoutEffect(()=>{
    const update=()=>{
      if(!ref.current||!groupRef.current||!workspaceRef.current||!bounds)return;
      const matrix=groupRef.current.getScreenCTM(),box=workspaceRef.current.getBoundingClientRect();if(!matrix)return;
      const p=new DOMPoint(bounds.x+bounds.width+26,bounds.y+bounds.height/2).matrixTransform(matrix);
      setAnchor({left:Math.max(80,Math.min(box.width-ref.current.offsetWidth-16,p.x-box.left)),top:Math.max(100,Math.min(box.height-ref.current.offsetHeight-24,p.y-box.top-ref.current.offsetHeight/2))});
    };
    update();const settle=setTimeout(update,260),observer=new ResizeObserver(update);if(workspaceRef.current)observer.observe(workspaceRef.current);if(ref.current)observer.observe(ref.current);return()=>{clearTimeout(settle);observer.disconnect();};
  },[bounds,groupRef,workspaceRef,viewKey,floors.length,overview]);
  const at=floors.findIndex(f=>f.level===level);
  return <nav ref={ref} className="floor-switcher" style={anchor||{right:20,top:'35%'}} aria-label="Floor switcher"><SketchFrame shape="tray"/>
    <button className="icon-button" title="Floor above" aria-label="Floor above" disabled={at<0||at===floors.length-1} onClick={()=>onLevel(floors[at+1].level)}><ChevronUp size={20}/></button>
    <div className="floor-level-buttons">{floors.map(f=><button key={f.level} className={level===f.level?'active':''} aria-label={`Show Level ${f.level}`} aria-current={level===f.level?'true':undefined} onClick={()=>onLevel(f.level)}><Layers size={15}/><span>{f.level}</span></button>)}</div>
    <button className="icon-button" title="Floor below" aria-label="Floor below" disabled={at<=0} onClick={()=>onLevel(floors[at-1].level)}><ChevronDown size={20}/></button>
    <span className="rail-divider"/>
    <button className={`icon-button ${overview?'active':''}`} title="Blueprint overview" aria-label="Blueprint overview" aria-pressed={overview} onClick={onOverview}><Grid2X2 size={19}/></button>
    {onNew&&<button className="icon-button" title="Draw a new floor" aria-label="Draw a new floor" onClick={onNew}><Plus size={20}/></button>}
  </nav>;
}

export function FloorOverview({home,activeLevel,onChoose,onClose}){
  const [page,setPage]=useState(0),floors=floorDescriptors(home),pages=Math.max(1,Math.ceil(floors.length/4)),at=Math.min(page,pages-1);
  return <section className="floor-overview" aria-label="Blueprint sheet overview"><header><div><small>BLUEPRINT SHEET</small><h2>Floor overview</h2></div><button className="button secondary" onClick={onClose}>Back to house</button></header>
    <div className="floor-overview-grid">{floors.slice(at*4,at*4+4).map(f=><button key={f.level} className={`floor-sheet ${f.level===activeLevel?'active':''}`} aria-label={`Open Level ${f.level}`} onClick={()=>onChoose(f.level)}><strong>Level {f.level}</strong><svg viewBox={`${f.x-60} ${f.y-50} ${f.width+120} ${f.height+100}`} aria-hidden="true"><FloorPlan home={floorHome(home,f)} hideLevelLabels onWallDown={()=>{}} onBoundaryDown={()=>{}} onOpeningDown={()=>{}}/></svg></button>)}</div>
    <footer><button className="button secondary" disabled={at===0} onClick={()=>setPage(at-1)}>Previous</button><span>Sheet {at+1} / {pages}</span><button className="button secondary" disabled={at===pages-1} onClick={()=>setPage(at+1)}>Next</button></footer>
  </section>;
}

export function StairInspector({stair,onChange,onDelete,onLayer}){
  return <div className="stair-inspector" role="toolbar" aria-label="Stair settings"><SketchFrame/>
    <label>Stairs<select aria-label="Stair type" value={stair.kind||'straight'} onChange={e=>onChange({kind:e.target.value})}>{STAIR_TYPES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    {onLayer&&<><button className="icon-button" title="Send stairs backward" aria-label="Send stairs backward" onClick={()=>onLayer('backward')}><ArrowDown size={18}/></button>
    <button className="icon-button" title="Bring stairs forward" aria-label="Bring stairs forward" onClick={()=>onLayer('forward')}><ArrowUp size={18}/></button></>}
    <button className="icon-button" title="Rotate stairs" aria-label="Rotate stairs" onClick={()=>onChange({rotation:((stair.rotation||0)+90)%360})}><RotateCw size={18}/></button>
    <label>Size<input type="range" aria-label="Stair size" min=".5" max="2" step=".1" value={stair.scale||1} onChange={e=>onChange({scale:Number(e.target.value)})}/></label>
    <button className="icon-button" title="Delete stairs" aria-label="Delete stairs" onClick={onDelete}><Trash2 size={18}/></button>
  </div>;
}
