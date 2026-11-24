import React,{useId,useLayoutEffect,useRef,useState} from 'react';
import {ChevronDown,Trash2} from 'lucide-react';
import {SketchFrame} from './SketchFrame.jsx';
import {blueprintGeometry,blueprintSource} from './blueprints.js';
import {floorDescriptors} from './floors.js';
import {floorOutlines} from './model.js';

export function BlueprintIcon(){
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z" strokeDasharray="2 3"/><path d="M8 16V8h8v5h-4v3z"/></svg>;
}
export function CanvasBlueprints({home,selected,onPointerDown}){
  const prefix=`blueprint-hit-${useId().replace(/:/g,'')}`;
  const path=ring=>'M'+ring.map(p=>`${p.x},${p.y}`).join(' L')+' Z';
  const occupied=floorOutlines(home).map(path).join(' ');
  return <g className="canvas-blueprints">{(home.blueprints||[]).map((b,index)=>{
    const {ring,source}=blueprintGeometry(home,b),active=selected===b.id;
    const d=path(ring),clipId=`${prefix}-${index}`;
    return <g key={b.id} className={`canvas-blueprint ${active?'is-selected':''}`} data-blueprint-id={b.id} aria-label={source?`Level ${source.level} reference blueprint`:'Reference blueprint (source removed)'} style={{cursor:'move'}} onPointerDown={onPointerDown?e=>onPointerDown(e,b):undefined}>
      <title>Drag the dotted outline or empty space inside it to move this reference.</title>
      <path d={d} fill="none" stroke={active?'#658653':'#829574'} strokeWidth={active?'2.5':'2'} strokeDasharray="3 6" strokeLinejoin="round" opacity={active?'.9':'.6'} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
      {/* The empty interior is draggable, but a real floor placed over the
          reference keeps receiving clicks. Clip paths also clip hit testing. */}
      <defs><clipPath id={clipId}><path d={`${d} ${occupied}`} clipRule="evenodd"/></clipPath></defs>
      <path className="blueprint-interior-hit" d={d} fill="transparent" clipPath={`url(#${clipId})`} pointerEvents="fill"/>
      <path className="blueprint-hit" d={d} fill="none" stroke="transparent" strokeWidth="16" vectorEffect="non-scaling-stroke" pointerEvents="stroke"/>
    </g>;
  })}</g>;
}
export function BlueprintToolbar({home,blueprint,groupRef,workspaceRef,viewKey,onSource,onDelete}){
  const ref=useRef(null),[anchor,setAnchor]=useState(null);
  const {bounds}=blueprintGeometry(home,blueprint),source=blueprintSource(home,blueprint),floors=floorDescriptors(home);
  useLayoutEffect(()=>{
    const update=()=>{
      const matrix=groupRef.current?.getScreenCTM(),workspace=workspaceRef.current,toolbar=ref.current;
      if(!matrix||!workspace||!toolbar)return;
      const box=workspace.getBoundingClientRect(),point=new DOMPoint(bounds.x+bounds.width/2,bounds.y).matrixTransform(matrix);
      const bottom=new DOMPoint(bounds.x+bounds.width/2,bounds.y+bounds.height).matrixTransform(matrix);
      const top=point.y-box.top-toolbar.offsetHeight-12;
      setAnchor({left:Math.max(12,Math.min(box.width-toolbar.offsetWidth-12,point.x-box.left-toolbar.offsetWidth/2)),top:Math.max(12,Math.min(box.height-toolbar.offsetHeight-12,top<12?bottom.y-box.top+12:top))});
    };
    update();const observer=new ResizeObserver(update);if(workspaceRef.current)observer.observe(workspaceRef.current);if(ref.current)observer.observe(ref.current);
    window.addEventListener('resize',update);return()=>{observer.disconnect();window.removeEventListener('resize',update);};
  },[bounds.x,bounds.y,bounds.width,bounds.height,groupRef,workspaceRef,viewKey]);
  return <div ref={ref} className="furniture-toolbar blueprint-toolbar" role="toolbar" aria-label="Selected blueprint tools" style={{...anchor,visibility:anchor?'visible':'hidden'}} onPointerDown={e=>e.stopPropagation()}>
    <SketchFrame/><BlueprintIcon/>
    <label className="blueprint-source"><select aria-label="Blueprint source level" value={source?.level??''} onChange={e=>onSource(Number(e.target.value))}>
      {!source&&<option value="" disabled>Source removed</option>}
      {floors.map(f=><option key={f.level} value={f.level}>Level {f.level}</option>)}
    </select><ChevronDown size={15} aria-hidden="true"/></label>
    <span className="furniture-tool-divider"/>
    <button className="icon-button" type="button" title="Delete blueprint" aria-label="Delete blueprint" onClick={onDelete}><Trash2 size={18}/></button>
  </div>;
}
