import React,{useLayoutEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,Copy,FlipHorizontal2,LockKeyhole,RotateCcw,RotateCw} from 'lucide-react';
import {SketchFrame} from './SketchFrame.jsx';

export function FurnitureToolbar({item,bounds,groupRef,workspaceRef,viewKey,onAction,onLock,canEdit}){
  const ref=useRef(null),[anchor,setAnchor]=useState(null);
  useLayoutEffect(()=>{
    const update=()=>{
      const matrix=groupRef.current?.getScreenCTM(),workspace=workspaceRef.current,toolbar=ref.current;
      if(!matrix||!workspace||!toolbar)return;
      const box=workspace.getBoundingClientRect();
      const top=new DOMPoint(bounds.x+bounds.width/2,bounds.y).matrixTransform(matrix);
      const bottom=new DOMPoint(bounds.x+bounds.width/2,bounds.y+bounds.height).matrixTransform(matrix);
      const width=toolbar.offsetWidth,height=toolbar.offsetHeight;
      let y=top.y-box.top-height-12;
      if(y<12)y=bottom.y-box.top+12;
      setAnchor({left:Math.max(12,Math.min(box.width-width-12,top.x-box.left-width/2)),top:Math.max(12,Math.min(box.height-height-12,y))});
    };
    update();const observer=new ResizeObserver(update);observer.observe(workspaceRef.current);observer.observe(ref.current);
    window.addEventListener('resize',update);return()=>{observer.disconnect();window.removeEventListener('resize',update);};
  },[bounds.x,bounds.y,bounds.width,bounds.height,groupRef,workspaceRef,viewKey]);
  const disabled=!canEdit||item.locked;
  const button=(action,title,Icon)=><button type="button" className="icon-button" title={title} aria-label={title} disabled={disabled} onClick={()=>onAction(action)}><Icon size={19} strokeWidth={1.65}/></button>;
  return <div ref={ref} className="furniture-toolbar" role="toolbar" aria-label="Selected furniture tools" style={{...anchor,visibility:anchor?'visible':'hidden'}} onPointerDown={e=>e.stopPropagation()}>
    <SketchFrame/>
    {button('backward','Send backward',ArrowDown)}{button('forward','Bring forward',ArrowUp)}
    <span className="furniture-tool-divider"/>
    {button('rotateBack','Rotate counterclockwise 45°',RotateCcw)}
    <output className="furniture-angle" aria-label="Furniture rotation">{Math.round(item.rotation||0)}°</output>
    {button('rotate','Rotate clockwise 45°',RotateCw)}
    {button('flip','Flip horizontally',FlipHorizontal2)}
    <span className="furniture-tool-divider"/>
    {button('duplicate','Duplicate piece',Copy)}
    <button type="button" className={`icon-button ${item.locked?'active':''}`} title={item.locked?'Unlock piece':'Lock piece'} aria-label={item.locked?'Unlock piece':'Lock piece'} aria-pressed={!!item.locked} disabled={!canEdit} onClick={onLock}><LockKeyhole size={18} strokeWidth={1.65}/></button>
  </div>;
}
