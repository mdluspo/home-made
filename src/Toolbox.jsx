import React,{useEffect,useRef,useState} from 'react';
import { ArrowDown,ArrowUp,Check,ChevronRight,Copy,FlipHorizontal2,MousePointer2,RotateCcw,RotateCw } from 'lucide-react';
import {StairGlyph} from './Stairs.jsx';
import {STAIR_TYPES} from './stairs.js';
import {BlueprintIcon} from './Blueprints.jsx';
import {SketchFrame} from './SketchFrame.jsx';

function ToolLabel({children}){
  return <span className="tool-hover-label" role="tooltip"><SketchFrame/><span>{children}</span></span>;
}

function ToolRailFrame({rail,open,hover,mode}){
  const [shape,setShape]=useState({width:55,height:225,tabs:[]});
  useEffect(()=>{
    const element=rail.current;if(!element)return;
    const update=()=>setShape({width:element.offsetWidth,height:element.offsetHeight,tabs:[...new Set([open,hover].filter(Boolean))].map(id=>element.querySelector(`[data-tool-group="${id}"]`)).filter(group=>group?.querySelector('.tool-group-arrow')).map(group=>({top:group.offsetTop+1,bottom:group.offsetTop+group.offsetHeight-1})).sort((a,b)=>a.top-b.top)});
    update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();
  },[rail,open,hover,mode]);
  const {width:w,height:h,tabs}=shape;
  const edge=tabs.map(t=>`L${w-1} ${t.top} Q${w+5} ${t.top-.5} ${w+12} ${t.top} L${w+13} ${t.bottom-3} Q${w+13} ${t.bottom} ${w+10} ${t.bottom} L${w-1} ${t.bottom}`).join(' ');
  return <svg className="sketch-frame tool-rail-frame" viewBox={`0 0 ${w+16} ${h}`} preserveAspectRatio="none" aria-hidden="true"><path className="sketch-contour" d={`M7 1.5 Q${w/2} .5 ${w-6} 1.5 Q${w-1} 1.5 ${w-1} 7 ${edge} L${w-1} ${h-6} Q${w-1} ${h-1} ${w-7} ${h-1} Q${w/2} ${h} 7 ${h-1} Q1 ${h-1} 1.5 ${h-7} L1.5 7 Q1 1.5 7 1.5Z`}/><path className="sketch-retrace" d={`M4.5 13Q4 35 4.7 50M12 ${h-3.5}Q${w/2} ${h-3} ${w-13} ${h-3.5}`}/></svg>;
}

export function ToolGlyph({kind,sideways=false}){
  if(kind==='stairs'||kind?.startsWith('stairs-'))return <StairGlyph kind={kind==='stairs'?'straight':kind.slice(7)} sideways={sideways}/>;
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind==='wall'?<path d="M4 19 20 5" strokeWidth="2"/>:kind==='rectangle'?<><path d="M4.1 5.2Q12 4.8 20 5.1L19.8 19Q11.6 18.7 4 19.1Z"/>{[[4,5],[20,5],[4,19],[20,19]].map(([x,y],i)=><rect key={i} x={x-1.5} y={y-1.5} width="3" height="3" fill="var(--tool-paper, #f8f7eb)" strokeWidth="1.2"/>)}</>:kind==='polygon'?<><path d="M4 18V7l9-3 7 7-5 9z"/>{[[4,18],[4,7],[13,4],[20,11],[15,20]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.5" fill="var(--tool-paper, #f8f7eb)" strokeWidth="1.2"/>)}</>:kind==='ellipse'?<><ellipse cx="12" cy="12" rx="9" ry="7"/><path d="M12 2v4m0 12v4M1 12h4m14 0h4" strokeWidth="1"/></>:kind==='boundary'?<><path d="M4 17q-3-9 3-12c5-4 4 4 9 1s8 10 3 13-7-2-11 1q-4 1-4-3Z"/><path d="m16 3 4 3m-1-4 3 3" strokeWidth="1"/></>:kind==='freeform'?<><path d="M4 19C4 4 20 20 20 5" strokeWidth="3"/><circle cx="4" cy="19" r="2" fill="var(--tool-paper, #f8f7eb)"/><circle cx="20" cy="5" r="2" fill="var(--tool-paper, #f8f7eb)"/></>:kind==='door'?<><path d="M4 21Q4.3 12 4 3.2L19 3Q18.7 13 19 21M2 21q9-.3 19 0"/><path d="m7 6 8-1v17l-8-3Z" fill="#d7dfc6"/><path d="M12 12v2" strokeWidth="1.8"/></>:kind==='window'?<><path d="M2 12h5m10 0h5" strokeWidth="5"/><path d="M7 12h10" strokeWidth="1.2"/></>:null}
  </svg>;
}
const GROUPS=[
  {id:'outline',name:'Home Outline',options:[{id:'rectangle',name:'Rectangle',hint:'Drag out a rectangular home'},{id:'polygon',name:'Polygon',hint:'Click corners; close at the first point'},{id:'ellipse',name:'Ellipse',hint:'Drag to draw a round home'},{id:'boundary',name:'Freehand outline',hint:'Draw any closed shape'}]},
  {id:'divider',name:'Room Dividers',options:[{id:'wall',name:'Straight divider',hint:'Draw a wall that splits your space'},{id:'freeform',name:'Curved divider',hint:'Draw a smooth, freeform wall'}]},
  {id:'openings',name:'Doors & Windows',options:[{id:'door',name:'Door',hint:'Place a door on a wall'},{id:'window',name:'Window',hint:'Place a window on a wall'}]},
  {id:'vertical',name:'Stairs',options:STAIR_TYPES.map(t=>({id:t.id==='straight'?'stairs':`stairs-${t.id}`,name:t.name,hint:'Click inside the active floor to place stairs'}))},
];
function ToolGroup({group,tool,choose,open,setOpen,hover}){
  const [last,setLast]=useState(group.options[0].id);
  const active=group.options.find(o=>o.id===tool),current=active||group.options.find(o=>o.id===last)||group.options[0];
  const select=id=>{setLast(id);choose(id);setOpen(null);};
  return <div data-tool-group={group.id} className={`tool-group ${active?'active':''} ${open?'is-open':''} ${hover===group.id?'tab-exposed':''}`}>
    <button className={`icon-button ${active?'active':''}`} aria-label={`${group.name}: ${current.name}`} aria-pressed={!!active} onClick={()=>select(current.id)}><ToolGlyph kind={current.id} sideways={group.id==='vertical'}/></button>
    <button className="tool-group-arrow" aria-label={`${group.name} options`} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(open?null:group.id)}><ChevronRight size={12}/></button>
    <ToolLabel>{group.name}</ToolLabel>
    {open&&<div className="tool-flyout" role="menu" aria-label={group.name}><span className="tool-flyout-heading">{group.name}</span>{group.options.map(o=><button key={o.id} role="menuitemradio" aria-checked={current.id===o.id} className={current.id===o.id?'chosen':''} onClick={()=>select(o.id)}><ToolGlyph kind={o.id}/><span><strong>{o.name}</strong><small>{o.hint}</small></span>{current.id===o.id&&<Check size={13}/>}</button>)}</div>}
  </div>;
}
export function Toolbox({mode,tool,onChoose,canEdit,hasSelection,onAction,locked,outlineEditMode='resize',onOutlineEditMode,onAddBlueprint,canAddBlueprint}){
  const [open,setOpen]=useState(null),[hover,setHover]=useState(null);const ref=useRef();
  useEffect(()=>{setOpen(null);setHover(null);},[mode]);
  useEffect(()=>{const click=e=>{if(!ref.current?.contains(e.target))setOpen(null);};const key=e=>{if(e.key==='Escape')setOpen(null);};document.addEventListener('pointerdown',click);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',click);document.removeEventListener('keydown',key);};},[]);
  const reveal=e=>{const group=e.target.closest('[data-tool-group]');if(group)setHover(group.dataset.toolGroup);};
  return <div ref={ref} className="tool-rail" role="toolbar" aria-label="Editor tools" onPointerOver={reveal} onPointerLeave={()=>setHover(null)} onFocusCapture={reveal} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHover(null);}}>
    <ToolRailFrame rail={ref} open={open} hover={hover} mode={mode}/>
    <div data-tool-group="selection" className={`tool-group ${tool==='select'?'active':''} ${open==='selection'?'is-open':''} ${hover==='selection'?'tab-exposed':''}`}>
      <button className={`icon-button ${tool==='select'?'active':''}`} aria-label="Select & move" aria-pressed={tool==='select'} onClick={()=>{onChoose('select');setOpen(null);}}><MousePointer2 size={19} strokeWidth={1.6}/></button>
      <ToolLabel>Selection</ToolLabel>
      {mode==='build'&&<><button className="tool-group-arrow" aria-label="Selection and shape editing options" aria-haspopup="menu" aria-expanded={open==='selection'} onClick={()=>setOpen(open==='selection'?null:'selection')}><ChevronRight size={12}/></button>{open==='selection'&&<div className="tool-flyout" role="menu" aria-label="Selection and shape editing"><span className="tool-flyout-heading">Floor resizing</span>{[{id:'resize',name:'Resize width & height',hint:'Drag a floor edge or a selection-box corner',glyph:'rectangle'},{id:'proportional',name:'Keep proportions',hint:'Scale evenly; or hold Shift while resizing',glyph:'ellipse'}].map(o=><button key={o.id} role="menuitemradio" aria-checked={outlineEditMode===o.id} className={outlineEditMode===o.id?'chosen':''} onClick={()=>{onOutlineEditMode(o.id);onChoose('select');setOpen(null);}}><ToolGlyph kind={o.glyph}/><span><strong>{o.name}</strong><small>{o.hint}</small></span>{outlineEditMode===o.id&&<Check size={13}/>}</button>)}</div>}</>}
    </div>
    <span className="rail-divider"/>
    {mode==='build'?<>{GROUPS.map(group=><ToolGroup key={group.id} group={group} tool={tool} choose={onChoose} open={open===group.id} setOpen={setOpen} hover={hover}/>)}<span className="rail-divider"/><div data-tool-group="blueprint" className={`tool-group ${hover==='blueprint'?'tab-exposed':''}`}><button className="icon-button" type="button" aria-label="Place a reference blueprint" disabled={!canEdit||!canAddBlueprint} onClick={()=>{onAddBlueprint?.();setOpen(null);}}><BlueprintIcon/></button><ToolLabel>Blueprint</ToolLabel></div></>:<>
      <div data-tool-group="transform" className={`tool-group ${open==='transform'?'is-open':''} ${hover==='transform'?'tab-exposed':''}`}>
        <button className="icon-button" aria-label="Rotate selected pieces" disabled={!hasSelection||locked||!canEdit} onClick={()=>onAction('rotate')}><RotateCw size={19}/></button>
        <button className="tool-group-arrow" aria-label="Transform options" aria-haspopup="menu" aria-expanded={open==='transform'} onClick={()=>setOpen(open==='transform'?null:'transform')}><ChevronRight size={12}/></button>
        <ToolLabel>Transform</ToolLabel>
        {open==='transform'&&<div className="tool-flyout" role="menu" aria-label="Transform"><span className="tool-flyout-heading">Transform</span>{[{id:'rotate',name:'Rotate clockwise',Icon:RotateCw},{id:'rotateBack',name:'Rotate counterclockwise',Icon:RotateCcw},{id:'flip',name:'Flip horizontally',Icon:FlipHorizontal2},{id:'duplicate',name:'Duplicate',Icon:Copy}].map(({id,name,Icon})=><button key={id} role="menuitem" disabled={!hasSelection||!canEdit} onClick={()=>{onAction(id);setOpen(null);}}><Icon size={19}/><span><strong>{name}</strong></span></button>)}</div>}
      </div>
      <div data-tool-group="layers" className={`tool-group ${open==='layers'?'is-open':''} ${hover==='layers'?'tab-exposed':''}`}>
        <button className="icon-button" aria-label="Bring forward" disabled={!hasSelection||!canEdit} onClick={()=>onAction('forward')}><ArrowUp size={19}/></button>
        <button className="tool-group-arrow" aria-label="Layer options" aria-haspopup="menu" aria-expanded={open==='layers'} onClick={()=>setOpen(open==='layers'?null:'layers')}><ChevronRight size={12}/></button>
        <ToolLabel>Layers</ToolLabel>
        {open==='layers'&&<div className="tool-flyout" role="menu" aria-label="Layers"><span className="tool-flyout-heading">Layers</span>{[{id:'forward',name:'Bring forward',Icon:ArrowUp},{id:'backward',name:'Send backward',Icon:ArrowDown}].map(({id,name,Icon})=><button key={id} role="menuitem" disabled={!hasSelection||!canEdit} onClick={()=>{onAction(id);setOpen(null);}}><Icon size={19}/><span><strong>{name}</strong></span></button>)}</div>}
      </div>
    </>}
  </div>;
}
