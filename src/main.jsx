import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Armchair, ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Coffee, Copy, DoorOpen, Download, Expand, Eye, FlipHorizontal2, Flower2, Grid2X2, Hammer, Hand, Heart, House, ImagePlus, Layers, Leaf as LeafIcon, Lightbulb, Link, LoaderCircle, LockKeyhole, Menu, MessageCircle, Minus, Moon, MousePointer2, Move, Paintbrush, Pencil, Plus, Redo2, RotateCcw, RotateCw, Save, Search, Send, Settings2, ShieldCheck, Sparkles, Sprout, Square, Sun, Trash2, Undo2, Upload, Users, Wallpaper, Wind, X } from 'lucide-react';
import { Character, Leaf } from './Art.jsx';
import { addDivider, addFloorSection, CATALOG, canMove, cleanPoints, DEFAULT_BOUNDARY, distanceToSegment, floorOutlines, getSections, homeSpawn, initialHome, makeId, nextFloorLevel, planArea, PLAN_UNIT, pointInPolygon, rectangleFromPoints, smoothPath } from './model.js';
import { Dimension, FloorPlan, FloorEdgeTargets, PlanFurniture } from './FloorPlan.jsx';
import { Neighborhood } from './Neighborhood.jsx';
import { Toolbox } from './Toolbox.jsx';
import { GameIcon } from './GameIcons.jsx';
import { SketchFrame, RulerMarks } from './SketchFrame.jsx';
import { FurnitureSelection, TopDownCharacter, TopDownFurniture, TopDownPreview, TopDownRoom } from './TopDown.jsx';
import { FurnitureToolbar } from './FurnitureToolbar.jsx';
import {DimensionEditor} from './DimensionEditor.jsx';
import {FurnitureCard,StickerDialog} from './StickerDialog.jsx';
import {BuildPlans,FloorStack,FloorSwitcher,FloorOverview,StairInspector} from './FloorViews.jsx';
import {floorAtPoint,floorHome,stackLayers,stairTravel} from './floors.js';
import {CanvasBlueprints,BlueprintToolbar} from './Blueprints.jsx';
import {changeBlueprintSource,makeBlueprint} from './blueprints.js';
import {orderedObjects,reorderObjects} from './layers.js';
import {StairObject} from './Stairs.jsx';
import {LevelLabels} from './LevelLabels.jsx';
import { boxFromPoints, deleteSelection, emptySelection, mergeSelection, moveSelection, moveVertex, outlineCorners, resizeOutline, selectInBox, selectionBounds, selectionCount, setPlanMeasurement, setWallThickness, transformFurniture } from './editor.js';
import { useWorld } from './useWorld.js';
import './styles.css';
import './game.css';
import './interface.css';

const CATEGORIES = [{ name: 'All pieces', icon: Grid2X2 }, { name: 'Furniture', icon: Armchair }, { name: 'Plants', icon: Sprout }, { name: 'Decor', icon: Flower2 }, { name: 'Lighting', icon: Lightbulb }, { name: 'Kitchen', icon: Coffee }, { name: 'Bedroom', icon: Moon }];
const iconProps = { size: 19, strokeWidth: 1.7 };
const ellipsePath=(a,b)=>{const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,rx=Math.abs(a.x-b.x)/2,ry=Math.abs(a.y-b.y)/2;return `M${cx-rx},${cy}a${rx},${ry} 0 1 0 ${rx*2},0a${rx},${ry} 0 1 0 ${-rx*2},0Z`;};
function IconButton({ icon: Icon, title, active, className = '', ...props }) {
  return <button type="button" className={`icon-button ${active ? 'active' : ''} ${className}`} title={title} aria-label={title} {...props}><Icon {...iconProps}/></button>;
}
function Finishes({home,commit,canEdit}){
  return <div className="finish-book">
    <p className="panel-description">Floorboards underfoot, a little color on the walls.</p>
    <fieldset disabled={!canEdit}><legend>Flooring</legend><div className="floor-options">{[{id:'oak',name:'Warm oak',color:'#d4b58a'},{id:'birch',name:'Light birch',color:'#e8d6b5'},{id:'tile',name:'Sage tile',color:'#b5bfa5'},{id:'rose',name:'Rosewood',color:'#c3a99b'}].map(f=><button key={f.id} aria-pressed={home.floor===f.id} className={home.floor===f.id?'active':''} onClick={()=>commit(h=>({...h,floor:f.id}))}><span className={`floor-swatch ${f.id}`} style={{backgroundColor:f.color}}>{home.floor===f.id&&<Check size={18}/>}</span><span>{f.name}</span></button>)}</div></fieldset>
    <fieldset disabled={!canEdit}><legend>Wall paint</legend><div className="wall-swatches">{['#e7e5cf','#d8dfc7','#d7dfdc','#e8d6c9','#e0d5df','#e9dfbb'].map(c=><button key={c} style={{background:c}} title={`Wall color ${c}`} aria-label={`Wall color ${c}`} aria-pressed={home.wallColor===c} className={home.wallColor===c?'active':''} onClick={()=>commit(h=>({...h,wallColor:c}))}>{home.wallColor===c&&<Check size={17}/>}</button>)}</div></fieldset>
    {!canEdit&&<p className="panel-description">Ask the homeowner for building permission to change these finishes.</p>}
  </div>;
}
function Modal({ title, eyebrow, children, onClose, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.focus();
    const key = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusables = [...dialog.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(el => !el.disabled);
        const first = focusables[0], last = focusables.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex="-1" ref={ref}><SketchFrame/><IconButton className="modal-close" title="Close dialog" icon={X} onClick={onClose}/><div className="modal-flower"><Leaf/></div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{children}</section></div>;
}

function App() {
  const [toast, setToast] = useState('');
  const toastTimer = useRef();
  const notify = useCallback(message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4800); }, []);
  const world = useWorld(notify);
  const { home, homeId, profile, role, players, status, commit, undo, redo, history } = world;
  const [mode, setMode] = useState('build');
  const [activeLevel,setActiveLevel]=useState(1);
  const [floorOverview,setFloorOverview]=useState(false);
  const [draftFloor,setDraftFloor]=useState(null);
  const [page, setPage] = useState('home');
  const [category, setCategory] = useState('All pieces');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedBlueprint,setSelectedBlueprint]=useState(null);
  const [measurementEdit,setMeasurementEdit]=useState(null);
  const [selectedWall, setSelectedWall] = useState(null);
  const [selection,setSelection]=useState(emptySelection);
  const [marquee,setMarquee]=useState(null);
  const [tool, setTool] = useState('rectangle');
  const [outlineEditMode,setOutlineEditMode]=useState('resize');
  const [floorContext,setFloorContext]=useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [shelf,setShelf]=useState('collection');
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const adjustZoom=useCallback(direction=>setZoom(z=>Math.max(.2,Math.min(3,Math.round((z+direction*.1)*10)/10))),[]);
  const [camera,setCamera]=useState({x:0,y:0});
  const [panning,setPanning]=useState(false);
  const [modal, setModal] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [position, setPosition] = useState({ x: 540, y: 575 });
  const [sitting, setSitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [draggedObjects,setDraggedObjects]=useState([]);
  const [stroke, setStroke] = useState([]);
  const [customTab, setCustomTab] = useState(false);
  const [neighborhood, setNeighborhood] = useState([]);
  const [loadingNeighbors, setLoadingNeighbors] = useState(false);
  const [access, setAccess] = useState({ public: true, collaborators: [] });
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteLink, setInviteLink] = useState('');
  const [formName, setFormName] = useState('');
  const [profileColor, setProfileColor] = useState('#a2ad83');
  const [upload, setUpload] = useState(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [editingStickerId, setEditingStickerId] = useState(null);
  const [editingStickerName, setEditingStickerName] = useState('');
  const [busy, setBusy] = useState(false);
  const svgRef = useRef(), groupRef = useRef(), workspaceRef = useRef(), fileRef = useRef();
  const dragging = useRef(null), drawing = useRef(null), polygonDraft = useRef([]), latestPoint = useRef(position), keys = useRef(new Set()), latest = useRef({ home, mode, page });
  const marqueeRef=useRef(null);
  const floorClickRef=useRef(null);
  const cameraDrag=useRef(null),suppressContextUntil=useRef(0);
  const visibleHome=preview?.home||home;
  const floorLayers=useMemo(()=>stackLayers(visibleHome,activeLevel),[visibleHome,activeLevel]);
  const activeHome=useMemo(()=>floorHome(visibleHome,draftFloor?null:floorLayers.active),[visibleHome,floorLayers.active,draftFloor]);
  const floorShift=mode==='build'?{x:0,y:0}:floorLayers.offset;
  latest.current = { home:activeHome, fullHome:home, activeLevel, mode, page }; latestPoint.current = position;
  useEffect(()=>{
    if(draftFloor){if(floorLayers.floors.some(f=>f.level===activeLevel))setDraftFloor(null);return;}
    if(floorLayers.active&&floorLayers.active.level!==activeLevel)setActiveLevel(floorLayers.active.level);
  },[floorLayers,activeLevel,draftFloor]);
  const editable = ['owner', 'builder', 'decorator'].includes(role);
  const buildable = ['owner', 'builder'].includes(role);
  useEffect(()=>{setMeasurementEdit(null);},[mode,homeId,camera,zoom]);
  useEffect(()=>{
    if(selectedBlueprint&&(mode!=='build'||selected||selectedWall||selectionCount(selection)>0||!(home.blueprints||[]).some(b=>b.id===selectedBlueprint)))setSelectedBlueprint(null);
  },[selectedBlueprint,mode,selected,selectedWall,selection,home.blueprints]);
  const selectedItem = home.items.find(i => i.id === selected);
  const selectedMeta = selectedItem && (CATALOG.find(i => i.type === selectedItem.type) || home.custom.find(i => i.id === selectedItem.type));
  const displayItems = [...(customTab ? [] : CATALOG), ...((customTab || page === 'stickers') ? home.custom.map(i => ({ ...i, type: i.id, category: 'My stickers', tag: 'Something uniquely yours' })) : [])].filter(i => (customTab || category === 'All pieces' || i.category === category) && i.name.toLowerCase().includes(query.toLowerCase()));
  const libraryItems=(shelf==='stickers'?home.custom.map(i=>({...i,type:i.id,tag:'Something uniquely yours'})):CATALOG).filter(i=>(shelf==='stickers'||category==='All pieces'||i.category===category)&&i.name.toLowerCase().includes(query.toLowerCase()));
  const closeModal = useCallback(() => setModal(null), []);
  useEffect(()=>{if(!floorContext)return;const close=e=>{if(!e.target.closest('.floor-context-menu'))setFloorContext(null);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[floorContext]);

  useEffect(() => { setSelected(null);setSelectedBlueprint(null); setSelectedWall(null);setSelection(emptySelection()); setPosition(homeSpawn(home));setCamera({x:0,y:0}); }, [homeId]);
  useEffect(()=>{const clear=()=>{cameraDrag.current=null;dragging.current=null;setPanning(false);setDraggedObjects([]);setPreview(null);};window.addEventListener('blur',clear);return()=>window.removeEventListener('blur',clear);},[]);
  useEffect(() => { if (role === 'viewer') setMode('explore'); }, [role]);
  const modifyItem = useCallback((id, values) => commit(h => ({ ...h, items: h.items.map(i => i.id === id ? { ...i, ...values } : i) })), [commit]);
  const removeSelected = useCallback(() => {
    if (!editable) return;
    if(selectedBlueprint){if(buildable)commit(h=>({...h,blueprints:(h.blueprints||[]).filter(b=>b.id!==selectedBlueprint)}));setSelectedBlueprint(null);return;}
    if(selectionCount(selection)>0){commit(h=>deleteSelection(h,selection));setSelection(emptySelection());setSelectedWall(null);setSelected(null);return;}
    if(!selectedItem||selectedItem.locked)return;
    commit(h => ({ ...h, items: h.items.filter(i => i.id !== selectedItem.id) })); setSelected(null);
  }, [editable,buildable,selectedBlueprint,selectedItem,selection,commit]);
  const duplicate = useCallback(() => {
    if (!selectedItem || !editable) return;
    const item = { ...selectedItem, id: makeId(), x: selectedItem.x + 30, y: selectedItem.y + 18, locked: false };
    commit(h => ({ ...h, items: [...h.items, item] })); setSelected(item.id);setSelection({...emptySelection(),items:[item.id]});
  }, [selectedItem, editable, commit]);
  const changeMode = next => {
    if (next === 'build' && !buildable) return notify('Your visitor pass doesn’t include building. Ask the owner for permission.');
    if (next === 'decorate' && !editable) return notify('You’re here to enjoy the view. Ask the owner for decorating permission.');
    if(next!=='build'&&activeHome.boundary.length<3) return notify('Draw your home’s outline first. Start with a rectangle or a custom shape.');
    setMode(next); setTool('select'); setSelected(null); setSelectedWall(null);setSelection(emptySelection()); setSitting(false); setPage('home');setPanelOpen(false);setMenuOpen(false);polygonDraft.current=[];setStroke([]);
    if(next==='explore') setPosition(homeSpawn(activeHome));
    if(next!==mode&&floorLayers.active){
      const f=floorLayers.active,shift=next==='build'?{x:0,y:0}:floorLayers.offset;
      setCamera({x:(540-f.x-shift.x-f.width/2)*zoom,y:(385-f.y-shift.y-f.height/2)*zoom});
    }
  };
  const pointFromEvent = (e,raw=false) => {
    const p = svgRef.current.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const ctm = groupRef.current?.getScreenCTM();
    const point = ctm ? p.matrixTransform(ctm.inverse()) : { x: 540, y: 385 };
    return point;
  };
  const addItem = (type, point) => {
    if (!editable) return notify('Ask the homeowner for decorating permission to add a piece.');
    if(activeHome.boundary.length<3)return notify('Build a space for your things first. Draw your home’s outline in Build mode.');
    if (home.items.length >= 300) return notify('Your home is full of lovely things. Remove a piece to make room.');
    const spawn=homeSpawn(activeHome);
    const item = { id: makeId(), type, x: point?.x ?? spawn.x, y: point?.y ?? spawn.y, scale: 1, rotation: 0 };
    commit(h => ({ ...h, items: [...h.items, item] }));
    setSelected(item.id);setSelection({...emptySelection(),items:[item.id]}); setMode('decorate'); setPage('home'); setTool('select');
  };
  const snapPoint = p => {
    const points = [...(home.boundary.length ? home.boundary : DEFAULT_BOUNDARY), ...home.walls.flatMap(w => [w.points[0], w.points.at(-1)])];
    const nearby = points.find(q => Math.hypot(q.x-p.x, q.y-p.y) < 23);
    if(nearby)return nearby;
    const wall=nearestWall(p);
    return wall.dist<13?wall.point:{ x: Math.round(p.x/10)*10, y: Math.round(p.y/10)*10 };
  };
  const nearestWall = p => {
    let best = { point: p, dist: Infinity };
    const boundary = home.boundary.length ? home.boundary : DEFAULT_BOUNDARY;
    for (const wall of [...floorOutlines(home).map(r=>({points:[...r,r[0]]})), ...home.walls]) {
      for (let i = 1; i < wall.points.length; i++) {
        const a = wall.points[i-1], b = wall.points[i], dx = b.x-a.x, dy = b.y-a.y;
        const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1)));
        const q = { x: a.x+t*dx, y: a.y+t*dy };
        const dist = Math.hypot(q.x-p.x,q.y-p.y);
        if (dist < best.dist) best = { point: q, dist, angle: Math.atan2(dy,dx)*180/Math.PI, length: Math.hypot(dx,dy), along: t*Math.hypot(dx,dy) };
      }
    }
    return best;
  };
  const cameraPoint=e=>{
    const p=svgRef.current.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
    return p.matrixTransform(svgRef.current.getScreenCTM().inverse());
  };
  const onCameraDown=e=>{
    if(e.button!==2||dragging.current||drawing.current||marqueeRef.current)return;
    e.preventDefault();e.stopPropagation();setFloorContext(null);
    cameraDrag.current={start:cameraPoint(e),screen:{x:e.clientX,y:e.clientY},camera,moved:false,pointerId:e.pointerId};
    setPanning(true);e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onSceneDown = e => {
    if (e.button !== 0) return;
    setSelectedBlueprint(null);
    const p = pointFromEvent(e);
    if (mode === 'explore') {
      if (canMove(p, activeHome)) { setPosition(p); latestPoint.current=p; world.send({ type: 'move', ...p }); setSitting(false); }
      return;
    }
    if(mode==='build'&&tool==='polygon'&&buildable){
      const point=snapPoint(p),draft=polygonDraft.current;
      if(draft.length>=3&&Math.hypot(point.x-draft[0].x,point.y-draft[0].y)<22){commit(h=>addFloorSection(h,[...draft],'polygon',draftFloor));polygonDraft.current=[];setStroke([]);return;}
      polygonDraft.current=[...draft,point];setStroke([...polygonDraft.current]);return;
    }
    if (mode === 'build' && ['rectangle', 'ellipse', 'wall', 'freeform', 'boundary'].includes(tool) && buildable) {
      const point = ['wall','rectangle','ellipse'].includes(tool) ? snapPoint(p) : p;
      drawing.current = [point]; setStroke([point]); e.currentTarget.setPointerCapture(e.pointerId); setSelected(null); return;
    }
    if (mode === 'build' && ['door', 'window'].includes(tool) && buildable) {
      const nearest = nearestWall(p);
      if (nearest.dist > 65) return notify('Place your ' + tool + ' a little closer to a wall.');
      if (nearest.length < 42 || nearest.along < 21 || nearest.length - nearest.along < 21) return notify('Leave a little space at the end of the wall so the whole ' + tool + ' stays inside your home.');
      const nearbyDoors = tool === 'door' ? home.openings.filter(o => o.type === 'door' && Math.abs(Math.sin(((o.angle||0)-nearest.angle)*Math.PI/180)) < .12 && Math.hypot(o.x-nearest.point.x,o.y-nearest.point.y) < 100) : [];
      if (nearbyDoors.some(o => Math.hypot(o.x-nearest.point.x,o.y-nearest.point.y) < 18)) return notify('That door is already occupied. Move it a little farther away.');
      if (nearbyDoors.length >= 2) return notify('A doorway can have at most two doors side by side.');
      commit(h => ({ ...h, openings: [...h.openings, { id: makeId(), type: tool, ...nearest.point, angle: nearest.angle, open: false }] })); return;
    }
    if (mode === 'build' && tool.startsWith('stairs') && buildable) {
      floorClickRef.current=null;
      const floor=floorAtPoint(home,p);
      if (!floor) return notify('Place the stairs inside a floor plan.');
      const kind=tool==='stairs'?'straight':tool.slice(7);
      const stair={id:makeId(),kind,x:p.x,y:p.y,rotation:0,scale:1,toLevel:floorLayers.floors.find(f=>f.level>floor.level)?.level||nextFloorLevel(home)};
      commit(h => ({ ...h, stairs: [...(h.stairs || []),stair] }));
      setTool('select');setSelection({...emptySelection(),stairs:[stair.id]});
      return;
    }
    if(tool==='select'&&editable){
      const raw=pointFromEvent(e,true);
      marqueeRef.current={start:raw,end:raw,base:e.shiftKey?selection:emptySelection()};setMarquee(marqueeRef.current);
      e.currentTarget.setPointerCapture(e.pointerId);
      if(!e.shiftKey){setSelection(emptySelection());setSelected(null);setSelectedWall(null);}
    }
  };
  const onSceneMove = e => {
    if(cameraDrag.current){
      const d=cameraDrag.current,p=cameraPoint(e);
      if(Math.hypot(e.clientX-d.screen.x,e.clientY-d.screen.y)>4)d.moved=true;
      setCamera({x:d.camera.x+p.x-d.start.x,y:d.camera.y+p.y-d.start.y});return;
    }
    const p = pointFromEvent(e);
    if(floorClickRef.current&&Math.hypot(e.clientX-floorClickRef.current.x,e.clientY-floorClickRef.current.y)>5)floorClickRef.current=null;
    if(marqueeRef.current){marqueeRef.current={...marqueeRef.current,end:pointFromEvent(e,true)};setMarquee(marqueeRef.current);return;}
    if(mode==='build'&&tool==='polygon'&&polygonDraft.current.length)setStroke([...polygonDraft.current,snapPoint(p)]);
    if (dragging.current) {
      const d = dragging.current;
      if(d.blueprintId){
        d.result={home:{...d.home,blueprints:d.home.blueprints.map(b=>b.id===d.blueprintId?{...b,x:b.x+p.x-d.start.x,y:b.y+p.y-d.start.y}:b)}};
        setPreview(d.result);
      }else if(d.outlineResize!==undefined){
        const target={x:p.x-d.handleOffset.x,y:p.y-d.handleOffset.y};
        if(e.ctrlKey){target.x=Math.round(target.x/10)*10;target.y=Math.round(target.y/10)*10;}
        d.result={home:resizeOutline(d.home,d.outlineResize,target,{proportional:d.proportional||e.shiftKey,sectionId:d.sectionId,sectionIds:d.sectionIds,control:d.control})};setPreview(d.result);
      }else if(d.group){
        const delta={x:p.x-d.start.x,y:p.y-d.start.y};
        d.result={home:moveSelection(d.home,d.selection,delta)};
        setPreview(d.result);
      }else if (d.wallId) {
        const target=d.vertexOffset?{x:p.x-d.vertexOffset.x,y:p.y-d.vertexOffset.y}:snapPoint(p);
        if(d.vertexOffset&&e.ctrlKey){target.x=Math.round(target.x/10)*10;target.y=Math.round(target.y/10)*10;}
        d.result={home:moveVertex(d.home,d.wallId,d.handle,target)};setPreview(d.result);
      } else if (d.resize) {
        setPreview({ id: d.id, scale: Math.max(.2,Math.min(3, Math.hypot(p.x-d.center.x,p.y-d.center.y)/d.distance*d.scale)) });
      } else setPreview({ id: d.id, x: p.x-d.offset.x, y:p.y-d.offset.y });
    }
    if (drawing.current) {
      if (['wall','rectangle','ellipse'].includes(tool)) {
        const a=drawing.current[0],b={...snapPoint(p)};
        if(tool==='wall'){if(Math.abs(a.x-b.x)<10)b.x=a.x;if(Math.abs(a.y-b.y)<10)b.y=a.y;}
        drawing.current = [a,b];
      }
      else drawing.current.push({ x:p.x, y:p.y });
      setStroke([...drawing.current]);
    }
  };
  const onSceneUp = e => {
    if(cameraDrag.current){
      const d=cameraDrag.current;cameraDrag.current=null;setPanning(false);suppressContextUntil.current=performance.now()+400;
      if(svgRef.current.hasPointerCapture(d.pointerId))svgRef.current.releasePointerCapture(d.pointerId);
      if(!d.moved)onFloorContext(e);return;
    }
    if(floorClickRef.current){
      const {sectionId}=floorClickRef.current;floorClickRef.current=null;
      const picked=home.sections?.find(s=>s.id===sectionId);if(picked?.level)setActiveLevel(picked.level);
      drawing.current=null;polygonDraft.current=[];setStroke([]);setPreview(null);
      setTool('select');setSelected(null);setSelectedWall(`section:${sectionId}`);
      setSelection({...emptySelection(),sections:[sectionId]});return;
    }
    if(marqueeRef.current){
      const m=marqueeRef.current,rect=boxFromPoints(m.start,m.end);
      const next=rect.width>3||rect.height>3?mergeSelection(m.base,selectInBox(mode==='build'?visibleHome:activeHome,rect,mode)):m.base;
      setSelection(next);setSelected(next.items.length===1&&!next.boundary&&!next.walls.length&&!next.sections.length?next.items[0]:null);setSelectedWall(next.sections.length===1?`section:${next.sections[0]}`:next.boundary&&!next.walls.length?'boundary':next.walls.length===1&&!next.boundary?next.walls[0]:null);
      marqueeRef.current=null;setMarquee(null);return;
    }
    if(tool==='polygon'&&polygonDraft.current.length)return;
    const result=dragging.current?.result||preview;
    if (dragging.current && result) {
      if(result.home)commit(result.home);
      else { const {id,...values}=result; modifyItem(id,values); }
    }
    if (drawing.current?.length > 1) {
      const points = cleanPoints(drawing.current, tool === 'wall');
      if(['rectangle','ellipse'].includes(tool)){
        let boundary=rectangleFromPoints(points[0],points.at(-1));
        if(tool==='ellipse'){const a=boundary[0],b=boundary[2],cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;boundary=Array.from({length:64},(_,i)=>({x:cx+(b.x-a.x)/2*Math.cos(i/64*Math.PI*2),y:cy+(b.y-a.y)/2*Math.sin(i/64*Math.PI*2)}));}
        if(planArea(boundary)>=1){commit(h=>addFloorSection(h,boundary,tool,draftFloor));}
      } else if (tool === 'boundary') {
        if (points.length > 3 && Math.abs(points.reduce((sum,p,i)=>{const n=points[(i+1)%points.length];return sum+p.x*n.y-n.x*p.y;},0)) > 5000) {
          commit(h=>addFloorSection(h,points,'freeform',draftFloor)); notify('A little place, in a shape all your own.');
        } else notify('Draw a larger, closed shape for your home.');
      } else if (Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)>12 || points.length>4) {
        commit(h=>addDivider(h,{id:makeId(),points,curved:tool==='freeform'}));
      }
    }
    dragging.current=null; drawing.current=null; setPreview(null); setStroke([]);setDraggedObjects([]);
  };
  const startGroupDrag=(e,next=selection)=>{
    e.stopPropagation();setSelection(next);
    setDraggedObjects([...next.items,...(next.stairs||[])]);
    if(mode==='build'){const floor=floorAtPoint(home,pointFromEvent(e));if(floor)setActiveLevel(floor.level);}
    dragging.current={group:true,home,selection:next,start:pointFromEvent(e)};
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const startBlueprintDrag=(e,blueprint)=>{
    if(e.button!==0||mode!=='build'||!buildable)return;
    e.preventDefault();e.stopPropagation();setTool('select');setSelectedBlueprint(blueprint.id);setSelected(null);setSelectedWall(null);setSelection(emptySelection());
    drawing.current=null;polygonDraft.current=[];floorClickRef.current=null;marqueeRef.current=null;setMarquee(null);setStroke([]);
    dragging.current={blueprintId:blueprint.id,home,start:pointFromEvent(e)};
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const toggleSelected=(kind,id)=>{
    const list=selection[kind]||[];
    const next={...selection,[kind]:list.includes(id)?list.filter(v=>v!==id):[...list,id]};
    setSelection(next);setSelected(null);setSelectedWall(null);
  };
  const onItemDown = (e,item) => {
    if(e.button!==0||mode==='explore'||!editable||mode==='build'&&tool!=='select')return;
    e.stopPropagation();
    setSelectedWall(null);
    if(e.shiftKey){toggleSelected('items',item.id);return;}
    setSelected(item.id);
    if (item.locked) {setSelection({...emptySelection(),items:[item.id]});return;}
    startGroupDrag(e,selection.items.includes(item.id)?selection:{...emptySelection(),items:[item.id]});
  };
  const onStairDown=(e,stair)=>{
    if(e.button!==0||mode==='explore'||!buildable)return;
    e.stopPropagation();setTool('select');setSelected(null);setSelectedWall(null);
    if(e.shiftKey){toggleSelected('stairs',stair.id);return;}
    startGroupDrag(e,selection.stairs?.includes(stair.id)?selection:{...emptySelection(),stairs:[stair.id]});
  };
  const startWallDrag = (e,wall,handle) => {
    if (e.button!==0 || mode!=='build' || !buildable) return;
    const floor=floorAtPoint(home,pointFromEvent(e));if(floor)setActiveLevel(floor.level);
    if (tool==='eraser') {commit(h=>({...h,walls:h.walls.filter(w=>w.id!==wall.id)}));return;}
    if (tool==='door'||tool==='window') return;
    e.stopPropagation();setTool('select');setSelected(null);
    drawing.current=null;polygonDraft.current=[];floorClickRef.current=null;setStroke([]);
    if(e.shiftKey){toggleSelected('walls',wall.id);return;}
    setSelectedWall(wall.id);
    if(handle===undefined){startGroupDrag(e,selection.walls.includes(wall.id)&&!selection.boundary&&!selection.sections?.length?selection:{...emptySelection(),walls:[wall.id]});return;}
    dragging.current={wallId:wall.id,home,handle};
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const startBoundaryDrag=(e,handle)=>{
    if(e.button!==0||mode!=='build'||!buildable)return;
    const picked=home.sections?.find(s=>s.id===handle?.sectionId);if(picked?.level)setActiveLevel(picked.level);
    const isHandle=handle?.kind==='vertex'||handle?.kind==='resize'||typeof handle==='number';
    if(tool!=='select'&&!isHandle){
      // A click picks the base; a drag still draws, including additions inside it.
      if(handle?.kind==='body'&&!['door','window'].includes(tool))floorClickRef.current={sectionId:handle.sectionId,x:e.clientX,y:e.clientY};
      return;
    }
    const sectionId=handle?.sectionId,wallId=sectionId?`section:${sectionId}`:'boundary';
    e.stopPropagation();setSelectedWall(wallId);setSelected(null);
    drawing.current=null;polygonDraft.current=[];floorClickRef.current=null;setStroke([]);
    if(isHandle){setTool('select');setSelection({...emptySelection(),...(sectionId?{sections:[sectionId]}:{boundary:true})});}
    if(handle?.kind==='resize'){
      const p=pointFromEvent(e),control=handle.control;
      dragging.current={outlineResize:handle.index,home,sectionId,control,handleOffset:{x:p.x-control.x,y:p.y-control.y},proportional:outlineEditMode==='proportional'};
      svgRef.current.setPointerCapture(e.pointerId);return;
    }
    if(handle?.kind==='vertex')handle=handle.index;
    if(typeof handle!=='number'){
      if(sectionId){
        if(e.shiftKey){toggleSelected('sections',sectionId);return;}
        startGroupDrag(e,selection.sections?.includes(sectionId)?selection:{...emptySelection(),sections:[sectionId]});return;
      }
      const next=e.shiftKey?{...selection,boundary:!selection.boundary}:selection.boundary?selection:{...emptySelection(),boundary:true};
      if(e.shiftKey){setSelection(next);return;}
      startGroupDrag(e,next);return;
    }
    const p=pointFromEvent(e),vertex=(picked?.points||home.boundary)[handle];
    dragging.current={wallId,home,handle,vertexOffset:{x:p.x-vertex.x,y:p.y-vertex.y}};
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const startOutlineBoxResize=(e,corner)=>{
    if(e.button!==0||mode!=='build'||!buildable)return;
    const sections=getSections(home).filter(s=>selection.boundary||selection.sections?.includes(s.id));
    const corners=outlineCorners(sections.flatMap(s=>s.points));if(corners.length!==4)return;
    e.preventDefault();e.stopPropagation();
    drawing.current=null;polygonDraft.current=[];floorClickRef.current=null;marqueeRef.current=null;setMarquee(null);setStroke([]);
    // The box is padded outside the shape. Measure from the real shape corner,
    // preserving the pointer offset so padding never changes the resize scale.
    const p=pointFromEvent(e),control={...corners[corner],anchor:corners[(corner+2)%4],axis:'both'};
    dragging.current={outlineResize:corner,home,sectionIds:sections.map(s=>s.id),control,handleOffset:{x:p.x-control.x,y:p.y-control.y},proportional:outlineEditMode==='proportional'};
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const startFloorEdgeResize=(e,{sectionIds,control,index,level})=>{
    if(e.button!==0||mode!=='build'||tool!=='select'||!buildable)return;
    e.preventDefault();e.stopPropagation();setSelected(null);setSelectedBlueprint(null);setActiveLevel(level);setMeasurementEdit(null);
    setSelectedWall(sectionIds.length===1?`section:${sectionIds[0]}`:null);setSelection({...emptySelection(),sections:sectionIds});
    drawing.current=null;polygonDraft.current=[];floorClickRef.current=null;marqueeRef.current=null;setMarquee(null);setStroke([]);
    const p=pointFromEvent(e);
    dragging.current={outlineResize:index,home,sectionIds,control,handleOffset:{x:p.x-control.x,y:p.y-control.y},proportional:outlineEditMode==='proportional'};
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const editMeasurement=(e,measurement)=>{
    if(mode!=='build'||!buildable)return;
    const label=e.currentTarget.getBoundingClientRect(),workspace=workspaceRef.current.getBoundingClientRect();
    const position={left:Math.max(12,Math.min(workspace.width-252,label.left+label.width/2-workspace.left-120)),top:Math.max(12,Math.min(workspace.height-240,label.bottom-workspace.top+8))};
    drawing.current=null;polygonDraft.current=[];floorClickRef.current=null;dragging.current=null;setPreview(null);setStroke([]);setTool('select');setSelected(null);setSelectedBlueprint(null);
    if(measurement.kind==='wall'){
      setSelectedWall(measurement.wallId);setSelection({...emptySelection(),walls:[measurement.wallId]});
    }else{
      setSelection({...emptySelection(),sections:measurement.sectionIds});setSelectedWall(measurement.sectionIds.length===1?`section:${measurement.sectionIds[0]}`:null);
    }
    setMeasurementEdit({measurement,position,value:Math.hypot(measurement.b.x-measurement.a.x,measurement.b.y-measurement.a.y)/PLAN_UNIT});
  };
  const saveMeasurement=value=>{
    if(!buildable||!measurementEdit)return 'Building permission is required.';
    const result=setPlanMeasurement(home,measurementEdit.measurement,value);
    if(result.error)return result.error;
    commit(result.home);setMeasurementEdit(null);return null;
  };
  const onFloorContext=e=>{
    if(mode!=='build'||!buildable)return;
    e.preventDefault();
    const p=pointFromEvent(e),sections=getSections(home);
    const section=[...sections].reverse().find(s=>pointInPolygon(p,s.points)||s.points.some((a,i)=>distanceToSegment(p,a,s.points[(i+1)%s.points.length])<12));
    if(!section)return;
    setSelection({...emptySelection(),sections:[section.id]});setSelectedWall(`section:${section.id}`);setSelected(null);
    setFloorContext({sectionId:section.id,x:Math.max(8,Math.min(e.clientX,window.innerWidth-235)),y:Math.max(8,Math.min(e.clientY,window.innerHeight-105))});
  };
  const interact = useCallback(() => {
    const h=latest.current.home, p=latestPoint.current;
    const travel=stairTravel(latest.current.fullHome,latest.current.activeLevel,p);
    if(travel){setActiveLevel(travel.level);setPosition(travel.position);latestPoint.current=travel.position;setSitting(false);world.send({type:'move',...travel.position});return;}
    const opening=h.openings.find(o=>o.type==='door'&&Math.hypot(o.x-p.x,o.y-p.y)<70);
    if(opening) {
      if(!['owner','builder'].includes(role)) return notify('The homeowner controls this door.');
      commit(h=>({...h,openings:h.openings.map(o=>o.id===opening.id?{...o,open:!o.open}:o)})); return;
    }
    const near=h.items.find(i=>['sofa','chair','bed','art','cat','kettle'].includes(i.type)&&Math.hypot(i.x-p.x,i.y-p.y)<110);
    if(near) {
      if(near.type==='cat') notify('A quiet little purr. You’ve been chosen.');
      else if(near.type==='kettle') notify('A warm cup of tea. Take your time.');
      else if(near.type==='art') notify('“A sunny little day” — a reminder to notice the little things.');
      else {setSitting(s=>!s);notify(near.type==='bed'?'Just five more minutes…':'Settle in. You’re home.');}
    } else notify('Walk closer to a chair, bed, or one of your little treasures.');
  },[role,commit,notify,world.send]);
  useEffect(()=>{
    let wheelDelta=0,lastWheelTime=0;
    const onZoomKey=e=>{
      if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
      const out=['-','_'].includes(e.key)||['Minus','NumpadSubtract'].includes(e.code);
      const into=['+','='].includes(e.key)||['Equal','NumpadAdd'].includes(e.code);
      const reset=e.key==='0'||e.code==='Digit0'||e.code==='Numpad0';
      if(!out&&!into&&!reset)return;
      // Zoom belongs to the canvas, never the page or its floating controls.
      // Suppress native page zoom on every app screen, even inside a dialog.
      e.preventDefault();e.stopPropagation();
      if(page!=='home')return;
      if(reset){setZoom(1);setCamera({x:0,y:0});}else adjustZoom(out?-1:1);
    };
    const onZoomWheel=e=>{
      // Chromium also emits Ctrl+wheel for trackpad pinch. This must be a
      // non-passive native listener; React/root wheel listeners may be passive.
      if(!e.ctrlKey&&!e.metaKey)return;
      e.preventDefault();e.stopPropagation();
      if(page!=='home')return;
      const time=performance.now();
      if(time-lastWheelTime>200)wheelDelta=0;
      lastWheelTime=time;
      wheelDelta+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?120:1);
      const steps=Math.trunc(wheelDelta/40);
      if(!steps)return;
      wheelDelta-=steps*40;
      adjustZoom(-Math.max(-3,Math.min(3,steps)));
    };
    window.addEventListener('keydown',onZoomKey,{capture:true});
    window.addEventListener('wheel',onZoomWheel,{capture:true,passive:false});
    return()=>{
      window.removeEventListener('keydown',onZoomKey,{capture:true});
      window.removeEventListener('wheel',onZoomWheel,{capture:true});
    };
  },[page,adjustZoom]);
  useEffect(()=>{
    const keydown=e=>{
      if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable) return;
      if(modal||editingStickerId||measurementEdit) return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&editable){e.preventDefault();e.shiftKey?redo():undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'&&mode==='decorate'){e.preventDefault();duplicate();return;}
      if((e.key==='Delete'||e.key==='Backspace')&&mode!=='explore'&&page==='home'){e.preventDefault();removeSelected();}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&page==='home'&&mode!=='explore'){
        const scope=mode==='build'?visibleHome:activeHome;
        e.preventDefault();setTool('select');setSelectedWall(null);setSelected(null);setSelection({boundary:false,sections:mode==='build'?scope.sections.map(s=>s.id):[],walls:mode==='build'?scope.walls.map(w=>w.id):[],items:scope.items.filter(i=>!i.locked).map(i=>i.id),openings:mode==='build'?scope.openings.map(o=>o.id):[],stairs:(scope.stairs||[]).map(s=>s.id)});
      }
      if(e.key.toLowerCase()==='v'&&!e.ctrlKey&&!e.metaKey&&mode!=='explore')setTool('select');
      if(e.key==='Escape'){floorClickRef.current=null;setFloorContext(null);setSelected(null);setSelectedBlueprint(null);setSelectedWall(null);setSelection(emptySelection());setTool('select');polygonDraft.current=[];setStroke([]);marqueeRef.current=null;setMarquee(null);dragging.current=null;setPreview(null);setDraggedObjects([]);}
      if(mode==='explore'&&page==='home'){
        if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();keys.current.add(e.key.toLowerCase());setSitting(false);}
        if(e.key.toLowerCase()==='e'&&!e.repeat) interact();
      }
    };
    const keyup=e=>keys.current.delete(e.key.toLowerCase());
    const clear=()=>keys.current.clear();
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);
    return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);keys.current.clear();};
  },[mode,page,modal,editingStickerId,measurementEdit,editable,undo,redo,duplicate,removeSelected,interact,home,activeHome]);
  useEffect(()=>{
    let frame,lastTime=performance.now(),lastSend=0;
    const tick=time=>{
      const dt=Math.min((time-lastTime)/1000,.04);lastTime=time;
      if(latest.current.mode==='explore'&&latest.current.page==='home'&&keys.current.size){
        const pressed=keys.current;
        let dx=Number(pressed.has('d')||pressed.has('arrowright'))-Number(pressed.has('a')||pressed.has('arrowleft'));
        let dy=Number(pressed.has('s')||pressed.has('arrowdown'))-Number(pressed.has('w')||pressed.has('arrowup'));
        const norm=Math.hypot(dx,dy)||1;dx=dx/norm*dt*125;dy=dy/norm*dt*125;
        const p=latestPoint.current,h=latest.current.home;
        const nx={x:p.x+dx,y:p.y},ny={x:p.x,y:p.y+dy};
        const next={x:canMove(nx,h)?nx.x:p.x,y:canMove(ny,h)?ny.y:p.y};
        latestPoint.current=next;setPosition(next);
        if(time-lastSend>55){world.send({type:'move',...next});lastSend=time;}
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[world.send]);
  const openNeighborhood = async () => {
    if(status!=='Saved')return notify('Let your last change finish saving before stepping outside.');
    world.enterStreet();setPanelOpen(false);setMenuOpen(false);
    setPage('neighborhood');setLoadingNeighbors(true);setSelected(null);
    try{setNeighborhood(await world.api('/neighborhood'));}catch(e){notify(e.message);}finally{setLoadingNeighbors(false);}
  };
  const returnHome=()=>{if(world.visit(profile.homeId)){setPage('home');setMenuOpen(false);setPanelOpen(false);setMode('build');setTool(home.boundary.length?'select':'rectangle');}};
  const enterFromStreet=h=>{if(world.visit(h.id)){setPage('home');setMode(h.owner.id===profile?.id?'decorate':'explore');setPanelOpen(false);}};
  useEffect(()=>{if(page!=='neighborhood')return;const timer=setInterval(()=>world.api('/neighborhood').then(setNeighborhood).catch(()=>{}),5000);return()=>clearInterval(timer);},[page,world.api]);
  const openInvite = async () => {
    setModal('invite');setInviteLink('');
    if(role==='owner') try{setAccess(await world.api(`/homes/${homeId}/access`));}catch(e){notify(e.message);}
  };
  const createInvite = async () => {
    setBusy(true);
    try{
      const {code}=await world.api(`/homes/${homeId}/invite`,{method:'POST',body:{role:inviteRole}});
      const link=`${location.origin}/?home=${homeId}&invite=${code}`;setInviteLink(link);
      try{await navigator.clipboard.writeText(link);notify('Invitation copied. A little company makes a home.');}catch{notify('Your invitation is ready. Copy the link below.');}
    }catch(e){notify(e.message);}finally{setBusy(false);}
  };
  const updateAccess = async values => {
    try{await world.api(`/homes/${homeId}/access`,{method:'PATCH',body:values});setAccess(await world.api(`/homes/${homeId}/access`));notify('Guest permissions updated.');}catch(e){notify(e.message);}
  };
  const handleUpload = async e => {
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))return notify('Choose a PNG, JPG, or WebP image.');
    if(file.size>15*1024*1024)return notify('Choose an image smaller than 15 MB.');
    setBusy(true);setModal('upload');setUpload(null);setRemoveBg(true);setPanelOpen(true);setPage('home');setMode('decorate');
    try{
      const source=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=source;});
      const scale=Math.min(1,650/Math.max(img.width,img.height));
      const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const original=canvas.toDataURL('image/png');
      const data=ctx.getImageData(0,0,canvas.width,canvas.height),pixels=data.data,w=canvas.width,h=canvas.height;
      const corners=[0,(w-1)*4,(h-1)*w*4,(h*w-1)*4];
      const bg=[0,1,2].map(c=>corners.reduce((s,i)=>s+pixels[i+c],0)/4);
      const visited=new Uint8Array(w*h),queue=[];
      const push=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const n=y*w+x;if(visited[n])return;visited[n]=1;queue.push(n);};
      for(let x=0;x<w;x++){push(x,0);push(x,h-1);}for(let y=0;y<h;y++){push(0,y);push(w-1,y);}
      let head=0;
      while(head<queue.length){const n=queue[head++],i=n*4;const diff=Math.hypot(pixels[i]-bg[0],pixels[i+1]-bg[1],pixels[i+2]-bg[2]);if(diff>85&&pixels[i+3]>10)continue;pixels[i+3]=diff<45?0:Math.round(pixels[i+3]*(diff-45)/40);const x=n%w,y=Math.floor(n/w);push(x-1,y);push(x+1,y);push(x,y-1);push(x,y+1);}
      ctx.putImageData(data,0,0);
      setUpload({name:'',original,processed:canvas.toDataURL('image/png')});
    }catch{notify('That image couldn’t be opened. Try another one.');setModal(null);}finally{setBusy(false);}
  };
  const saveUpload=()=>{
    if(!upload||!upload.name.trim())return notify('Give your sticker a name before adding it.');
    if(home.custom.length>=50)return notify('Your sticker book is full. Remove a custom sticker to add another.');
    const sticker={id:makeId(),name:upload.name.trim().slice(0,40),src:removeBg?upload.processed:upload.original};
    commit(h=>({...h,custom:[...h.custom,sticker]}));setCustomTab(true);setShelf('stickers');setModal(null);setUpload(null);setPage('home');notify('A little piece of you, added to your sticker book.');
  };
  const openRenameSticker=sticker=>{if(!editable)return;setEditingStickerId(sticker.id);setEditingStickerName(sticker.name);setPanelOpen(true);setMode('decorate');setPage('home');};
  const saveStickerRename=()=>{
    if(!editingStickerId||!editingStickerName.trim())return;
    commit(h=>({...h,custom:h.custom.map(s=>s.id===editingStickerId?{...s,name:editingStickerName.trim().slice(0,40)}:s)}));
    setEditingStickerId(null);setEditingStickerName('');notify('Sticker name updated.');
  };
  const moveLayer=direction=>{
    if(!selectedItem)return;
    commit(h=>reorderObjects(h,[selectedItem.id],direction>0?'forward':'backward',orderedObjects(activeHome).map(e=>e.object.id)));
  };
  const exportHome=()=>{
    const blob=new Blob([JSON.stringify({name:home.name,exportedAt:new Date().toISOString(),home},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-home-made.json';a.click();URL.revokeObjectURL(url);notify('Your little home, packed up as a backup.');
  };
  const startFreshPlan=()=>{
    if(role!=='owner'||homeId!==profile?.homeId)return;
    commit(h=>({...initialHome(),name:h.name,custom:h.custom}));
    dragging.current=null;drawing.current=null;polygonDraft.current=[];marqueeRef.current=null;floorClickRef.current=null;
    setPreview(null);setStroke([]);setMarquee(null);setFloorContext(null);
    setSelected(null);setSelectedWall(null);setSelection(emptySelection());
    setPage('home');setMode('build');setTool('rectangle');setPanelOpen(false);setMenuOpen(false);setSitting(false);
    setCamera({x:0,y:0});setZoom(1);
    notify('A fresh plan, ready to draw. Undo restores your previous layout until you refresh.');
  };
  const openProfile=()=>{setFormName(profile?.name||'Little dreamer');setProfileColor(profile?.color||'#a2ad83');setModal('profile');};
  const nearItem=mode==='explore'&&activeHome.items.find(i=>['sofa','chair','bed','art','cat','kettle'].includes(i.type)&&Math.hypot(i.x-position.x,i.y-position.y)<110);
  const nearTravel=mode==='explore'&&stairTravel(home,activeLevel,position);
  const sceneHome=mode==='build'?visibleHome:activeHome;
  const sceneItems=sceneHome.items.map(i=>preview?.id===i.id?{...i,...preview}:i);
  const sceneObjects=orderedObjects({...sceneHome,items:sceneItems},{useLayers:mode!=='build'}).sort((a,b)=>Number(draggedObjects.includes(a.object.id))-Number(draggedObjects.includes(b.object.id)));
  const selectedStair=(visibleHome.stairs||[]).find(s=>selection.stairs?.length===1&&selection.stairs[0]===s.id);
  const blueprint=(visibleHome.blueprints||[]).find(b=>b.id===selectedBlueprint);
  const groupCount=selectionCount(selection);
  const selectionGap=mode==='build'&&(selection.boundary||selection.sections?.length)?22:12;
  const rawGroupBounds=selectionBounds(visibleHome,selection,mode),extraPadding=selectionGap/zoom-12;
  const groupBounds=rawGroupBounds?{x:rawGroupBounds.x-extraPadding,y:rawGroupBounds.y-extraPadding,width:rawGroupBounds.width+extraPadding*2,height:rawGroupBounds.height+extraPadding*2}:null;
  const canResizeOutline=mode==='build'&&buildable&&(selection.boundary||selection.sections?.length>0);
  const openingSelectionOnly=selection.openings.length>0&&!selection.items.length&&!selection.stairs?.length&&!selection.walls.length&&!selection.boundary&&!selection.sections.length;
  const singleFurnitureSelection=mode==='decorate'&&selectedItem&&groupCount===1&&selection.items.includes(selectedItem.id);
  const furnitureBounds=selectedItem?selectionBounds(visibleHome,{...emptySelection(),items:[selectedItem.id]},'decorate'):null;
  const selectedWallData=selectedWall&&!selectedWall.startsWith('section:')?visibleHome.walls.find(w=>w.id===selectedWall):null;
  const changeFloor=level=>{
    setActiveLevel(level);setDraftFloor(null);setFloorOverview(false);setSelection(emptySelection());setSelected(null);setSelectedWall(null);setPreview(null);setStroke([]);setTool('select');setSitting(false);
    dragging.current=null;drawing.current=null;polygonDraft.current=[];
    const data=floorHome(home,floorLayers.floors.find(f=>f.level===level));setPosition(homeSpawn(data));
    const floor=floorLayers.floors.find(f=>f.level===level);
    if(mode==='build'&&floor)setCamera({x:(540-floor.x-floor.width/2)*zoom,y:(385-floor.y-floor.height/2)*zoom});
  };
  const drawNewFloor=()=>{
    if(floorLayers.floors.length>=50)return notify('You can add up to 50 floors.');
    const floors=floorLayers.floors,level=nextFloorLevel(home);
    const origin={x:Math.max(0,...floors.map(f=>f.x+f.width))+400,y:floors[0]?.y||200},previous=floors.at(-1);
    setDraftFloor(origin);setActiveLevel(level);setMode('build');setFloorOverview(false);setPanelOpen(false);setSelection(emptySelection());setSelected(null);setSelectedWall(null);setTool('rectangle');
    setCamera({x:(540-origin.x-(previous?.width||400)/2)*zoom,y:(385-origin.y-(previous?.height||300)/2)*zoom});
  };
  const addBlueprint=()=>{
    if(!buildable||!floorLayers.floors.length||(home.blueprints||[]).length>=50)return;
    const source=floorLayers.floors[0],rect=svgRef.current.getBoundingClientRect();
    const center=pointFromEvent({clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2});
    const reference=makeBlueprint(home,source.level,{x:center.x-source.width/2,y:center.y-source.height/2});if(!reference)return;
    commit(h=>({...h,blueprints:[...(h.blueprints||[]),reference]}));
    floorClickRef.current=null;drawing.current=null;polygonDraft.current=[];setStroke([]);setPreview(null);setDraftFloor(null);setTool('select');setSelected(null);setSelectedWall(null);setSelection(emptySelection());setSelectedBlueprint(reference.id);
  };
  const chooseTool=id=>{setSelectedBlueprint(null);floorClickRef.current=null;setTool(id);polygonDraft.current=[];drawing.current=null;setStroke([]);if(id!=='select'){setSelection(emptySelection());setSelected(null);setSelectedWall(null);}};
  const toolAction=action=>{
    if(!editable)return;
    if(action==='delete'){removeSelected();return;}
    const ids=selection.items.length?selection.items:selected?[selected]:[];
    if(action==='forward'||action==='backward'){
      if(mode!=='decorate')return;
      const stairs=buildable?(selection.stairs||[]):[];
      commit(h=>reorderObjects(h,[...ids,...stairs],action,orderedObjects(activeHome).map(e=>e.object.id)));return;
    }
    if(action==='duplicate'){
      const added=home.items.filter(i=>ids.includes(i.id)).map(i=>({...i,id:makeId(),x:i.x+30,y:i.y+18,locked:false}));
      if(!added.length)return;commit(h=>({...h,items:[...h.items,...added]}));setSelection({...emptySelection(),items:added.map(i=>i.id)});setSelected(added.length===1?added[0].id:null);return;
    }
    commit(h=>transformFurniture(h,ids,action));
  };
  return <div className={`app ${panelOpen?'drawer-open':''} ${modal==='upload'||editingStickerId?'is-uploading':''}`}>
    <div className="game-hud">
      <div className="hud-left">
        <button className="game-menu-trigger" onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-label="Game menu"><SketchFrame/><Menu size={24}/><span>Menu</span></button>
        <span className="game-save-status" role="status"><span className={`save-dot ${status==='Saved'?'is-saved':''}`}/>{status}</span>
        {buildable&&page==='neighborhood'&&<button className="home-plaque" onClick={()=>{setFormName(home.name);setModal('rename');}} aria-label={`Rename ${home.name}`}><SketchFrame/><span className="plaque-house"><House size={34}/></span><span><strong>{home.name}</strong><small><Pencil size={10}/> click to rename</small></span></button>}
        {menuOpen&&<nav className="game-menu" aria-label="Game menu"><SketchFrame/><button onClick={()=>{if(page==='neighborhood'&&!world.visit(profile.homeId))return;setPage('stickers');setCategory('All pieces');setQuery('');setMenuOpen(false);}}><BookOpen size={17}/>Sticker book</button><button onClick={()=>{setModal('help');setMenuOpen(false);}}><CircleHelp size={17}/>How to play</button><button onClick={()=>{setZoom(1);setCamera({x:0,y:0});setMenuOpen(false);}}><Eye size={17}/>Reset view</button><button onClick={exportHome}><Download size={17}/>Save a backup</button>{role==='owner'&&homeId===profile?.homeId&&<button onClick={startFreshPlan} title="Clear rooms and placed furniture. Keeps stickers. You can undo before refreshing."><RotateCcw size={17}/>Start a fresh plan</button>}</nav>}
      </div>
      <div className="hud-right">
        {page==='home'?<div className="mode-switch" aria-label="Game mode"><SketchFrame/>{[{id:'build',name:'Build'},{id:'decorate',name:'Decorate'},{id:'explore',name:'Explore'}].map(({id,name})=><button key={id} aria-pressed={mode===id} className={mode===id?'active':''} onClick={()=>changeMode(id)}><GameIcon kind={id}/><span>{name}</span></button>)}</div>:<button className="hud-button" onClick={returnHome}><GameIcon kind="home"/><span>Back home</span></button>}
        {page==='home'&&mode!=='build'&&<div className={`hud-utilities ${panelOpen?'is-away':''}`} inert={panelOpen}><SketchFrame/><button className="hud-button" aria-label={mode==='decorate'?'Furniture collection':'At home'} aria-expanded={panelOpen} aria-controls="furnish-drawer" onClick={()=>setPanelOpen(true)}>{mode==='explore'?<Coffee size={28}/>:<GameIcon kind="furnish"/>}<span>{mode==='decorate'?'Furnish':'At home'}</span></button></div>}
      </div>
    </div>

    {page==='home'&&<main className={`editor-layout ${panelOpen?'panel-is-open':''}`}>
      <section className={`workspace ${mode==='build'?'building':''} tool-${tool} ${panning?'camera-panning':''}`} ref={workspaceRef} aria-label="Your home editor">
        {!floorOverview&&mode!=='explore'&&<Toolbox mode={mode} tool={tool} onChoose={chooseTool} canEdit={editable} hasSelection={groupCount>0||!!selectedItem} locked={selectedItem?.locked} onAction={toolAction} outlineEditMode={outlineEditMode} onOutlineEditMode={setOutlineEditMode} onAddBlueprint={addBlueprint} canAddBlueprint={buildable&&floorLayers.floors.length>0&&(home.blueprints||[]).length<50}/>}

        {mode==='build'&&tool!=='select'&&<div className="drawing-hint"><Pencil size={14}/>{({rectangle:'Click and drag to draw your home outline',polygon:'Click each corner. Click the first point to close your outline.',wall:'Click and drag to divide a room',freeform:'Draw freely. We’ll smooth the little wobbles.',boundary:'Draw a closed outline to reshape your home',door:'Click near a wall to add a door',window:'Click near a wall to add a window',eraser:'Click a wall or opening to remove it'})[tool]}</div>}
        {!floorOverview&&<svg ref={svgRef} className="room-scene" viewBox="0 0 1080 760" role="img" aria-label={mode==='build'?'Top-down floor plan editor':'Your top-down home'} onContextMenu={e=>{e.preventDefault();if(!cameraDrag.current&&performance.now()>suppressContextUntil.current)onFloorContext(e);}} onPointerDownCapture={onCameraDown} onPointerDown={onSceneDown} onPointerMove={onSceneMove} onPointerUp={onSceneUp} onPointerCancel={()=>{cameraDrag.current=null;setPanning(false);dragging.current=null;setDraggedObjects([]);drawing.current=null;floorClickRef.current=null;marqueeRef.current=null;setMarquee(null);setPreview(null);setStroke([]);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';}} onDrop={e=>{e.preventDefault();const type=e.dataTransfer.getData('application/home-made');if(type)addItem(type,pointFromEvent(e));}}>
          <g ref={groupRef} transform={`translate(${camera.x+540*(1-zoom)} ${camera.y+385*(1-zoom)}) scale(${zoom}) translate(${floorShift.x} ${floorShift.y})`}>
            {mode==='build'?<BuildPlans home={visibleHome} selectedWall={selectedWall} selection={selection} onWallDown={startWallDrag} onBoundaryDown={startBoundaryDrag} onDimensionEdit={buildable?editMeasurement:undefined} showGrid={home.grid} onOpeningDown={(e,o)=>{if(tool!=='select')return;e.stopPropagation();if(e.shiftKey){toggleSelected('openings',o.id);return;}setSelectedWall(null);setSelected(null);setSelection({...emptySelection(),openings:[o.id]});}}/>:<FloorStack home={visibleHome} level={activeLevel} externalObjects showLabels={false} onDoor={o=>{if(mode!=='explore')return;if(!buildable)return notify('The homeowner controls this door.');const ids=new Set(o.doorIds||[o.id]);commit(h=>({...h,openings:h.openings.map(d=>ids.has(d.id)?{...d,open:!d.open}:d)}));}}/>}
            {mode==='build'&&<CanvasBlueprints home={visibleHome} selected={selectedBlueprint} onPointerDown={startBlueprintDrag}/>}
            {mode==='build'&&tool==='select'&&buildable&&!selectedBlueprint&&<FloorEdgeTargets home={visibleHome} onResize={startFloorEdgeResize}/>}
            <g className="decoration-layer">{sceneObjects.map(({kind,object:item})=>kind==='stair'?<StairObject key={item.id} stair={item} decorated={mode!=='build'} onPointerDown={onStairDown} destinationLevel={floorLayers.floors.find(f=>f.level===item.toLevel&&f.level>activeLevel)?.level||floorLayers.floors.find(f=>f.level>activeLevel)?.level}/>:mode==='build'?<PlanFurniture key={item.id} item={item} home={home} onPointerDown={onItemDown}/>:<g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation||0}) scale(${item.scale||1})`} className={`furniture ${mode==='decorate'?'can-drag':''} ${selection.items.includes(item.id)?'is-selected':''}`} onPointerDown={e=>onItemDown(e,item)} style={{opacity:item.opacity??1}}>
                <g transform={`scale(${item.flipped?-1:1} 1)`}><TopDownFurniture type={item.type} custom={home.custom.find(c=>c.id===item.type)}/></g>
                {mode==='decorate'&&selected===item.id&&groupCount<=1&&<FurnitureSelection item={item} onResize={(e,i)=>{if(i.locked)return;e.stopPropagation();setDraggedObjects([i.id]);const p=pointFromEvent(e);dragging.current={id:i.id,resize:true,scale:i.scale,center:{x:i.x,y:i.y},distance:Math.max(1,Math.hypot(p.x-i.x,p.y-i.y))};svgRef.current.setPointerCapture(e.pointerId);}}/>}
              </g>)}</g>
            {mode==='explore'&&home.boundary.length>2&&<TopDownCharacter {...position} color={profile?.color} name={profile?.name} sitting={sitting}/>}
            {mode!=='build'&&players.filter(p=>p.id!==profile?.id).map(p=><TopDownCharacter key={p.connectionId} {...p.position} color={p.color} name={p.name}/>)}
            {!!stroke.length&&<g pointerEvents="none">{['rectangle','ellipse'].includes(tool)&&stroke.length>1?<><path d={tool==='ellipse'?ellipsePath(stroke[0],stroke.at(-1)):'M'+rectangleFromPoints(stroke[0],stroke.at(-1)).map(p=>p.x+','+p.y).join(' L')+' Z'} fill="#f9fbef88" stroke="#7c9965" strokeWidth="3" strokeDasharray="7 4"/><Dimension a={rectangleFromPoints(stroke[0],stroke.at(-1))[0]} b={rectangleFromPoints(stroke[0],stroke.at(-1))[1]} live/><Dimension a={rectangleFromPoints(stroke[0],stroke.at(-1))[1]} b={rectangleFromPoints(stroke[0],stroke.at(-1))[2]} live/></>:<><path d={['wall','polygon'].includes(tool)?'M'+stroke.map(p=>p.x+','+p.y).join(' L'):smoothPath(stroke,tool==='boundary')} fill={['polygon','boundary'].includes(tool)?'#c1cda329':'none'} stroke="#7c9965" strokeWidth="3" strokeDasharray="7 4" strokeLinecap="round"/>{tool==='wall'&&stroke.length>1&&<Dimension a={stroke[0]} b={stroke.at(-1)} live/>}{tool==='polygon'&&stroke.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===0?6:3} fill="#f9fbef" stroke="#7c9965" strokeWidth="1.5"/>)}</>}</g>}
            {tool==='select'&&groupBounds&&groupCount>0&&!singleFurnitureSelection&&<g className="group-selection"><rect {...groupBounds} rx="3" fill="none" stroke="#fffdf1" strokeWidth="5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none"/><rect {...groupBounds} rx="3" fill="none" stroke="#5d7e48" strokeWidth="2.2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents={openingSelectionOnly?'none':'stroke'} onPointerDown={openingSelectionOnly?undefined:e=>startGroupDrag(e)}/>
              {[[groupBounds.x,groupBounds.y],[groupBounds.x+groupBounds.width,groupBounds.y],[groupBounds.x+groupBounds.width,groupBounds.y+groupBounds.height],[groupBounds.x,groupBounds.y+groupBounds.height]].map(([x,y],i)=><g key={i} className={canResizeOutline?'selection-box-resize-handle':undefined} aria-label={canResizeOutline?`Resize outline width and height ${i+1}`:undefined} pointerEvents={canResizeOutline?'all':'none'} style={canResizeOutline?{cursor:i%2===0?'nwse-resize':'nesw-resize'}:undefined} onPointerDown={canResizeOutline?e=>startOutlineBoxResize(e,i):undefined}>
                {canResizeOutline&&<rect x={x-10/zoom} y={y-10/zoom} width={20/zoom} height={20/zoom} fill="transparent"/>}
                <rect x={x-4/zoom} y={y-4/zoom} width={8/zoom} height={8/zoom} rx={1/zoom} fill="#fffdf1" stroke="#5d7e48" strokeWidth="1.6" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
              </g>)}
            </g>}
            {marquee&&<rect {...boxFromPoints(marquee.start,marquee.end)} className="selection-marquee" fill="#9ab47a25" stroke="#5d7e48" strokeWidth="1.8" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
            <LevelLabels home={mode==='build'?visibleHome:activeHome} raised={mode!=='build'}/>
          </g>
        </svg>}
        {measurementEdit&&mode==='build'&&<DimensionEditor key={`${measurementEdit.measurement.kind}-${measurementEdit.measurement.a.x}-${measurementEdit.measurement.a.y}-${measurementEdit.measurement.b.x}-${measurementEdit.measurement.b.y}`} value={measurementEdit.value} position={measurementEdit.position} kind={measurementEdit.measurement.kind} onSave={saveMeasurement} onCancel={()=>setMeasurementEdit(null)}/>}
        {floorOverview&&<FloorOverview home={home} activeLevel={activeLevel} onChoose={changeFloor} onClose={()=>setFloorOverview(false)}/>}
        {mode!=='build'&&!floorOverview&&floorLayers.floors.length>0&&<FloorSwitcher floors={floorLayers.floors} level={activeLevel} onLevel={changeFloor} onNew={buildable?drawNewFloor:undefined} overview={floorOverview} onOverview={()=>{setFloorOverview(true);setPanelOpen(false);}} bounds={floorLayers.active} groupRef={groupRef} workspaceRef={workspaceRef} viewKey={`${camera.x},${camera.y},${zoom},${activeLevel}`}/>}
        {mode==='build'&&!floorOverview&&blueprint&&buildable&&!preview&&!panning&&<BlueprintToolbar home={home} blueprint={blueprint} groupRef={groupRef} workspaceRef={workspaceRef} viewKey={`${camera.x},${camera.y},${zoom}`} onSource={level=>commit(h=>changeBlueprintSource(h,blueprint.id,level))} onDelete={removeSelected}/>}
        {!floorOverview&&selectedStair&&buildable&&!preview&&<StairInspector stair={selectedStair} onChange={values=>commit(h=>({...h,stairs:(h.stairs||[]).map(s=>s.id===selectedStair.id?{...s,...values}:s)}))} onLayer={mode==='decorate'?toolAction:undefined} onDelete={removeSelected}/>}
        {draftFloor&&<div className="new-floor-prompt">Draw Level {activeLevel}<button onClick={()=>changeFloor(floorLayers.floors[0]?.level||1)}>Cancel</button></div>}
        {mode==='decorate'&&selectedItem&&furnitureBounds&&groupCount<=1&&!preview&&!panning&&<FurnitureToolbar item={selectedItem} bounds={furnitureBounds} groupRef={groupRef} workspaceRef={workspaceRef} viewKey={`${camera.x},${camera.y},${zoom}`} canEdit={editable} onAction={toolAction} onLock={()=>modifyItem(selectedItem.id,{locked:!selectedItem.locked})}/>}
        {mode==='explore'&&nearItem&&<button className="interaction-prompt" onClick={interact}><kbd>E</kbd>{sitting?'Get comfortable':nearItem.type==='bed'?'Rest a little':nearItem.type==='cat'?'Say hello':nearItem.type==='art'?'Take a closer look':nearItem.type==='kettle'?'A cup of tea':'Take a seat'}</button>}
        {mode==='explore'&&nearTravel&&<button className="interaction-prompt stair-travel-prompt" onClick={interact}><kbd>E</kbd>Go to Level {nearTravel.level}</button>}
        {!home.boundary.length&&!stroke.length&&<div className="empty-game-prompt"><div className="empty-plan-mark"><Square size={42} strokeWidth={1}/><Pencil size={24} strokeWidth={1.4}/></div><h1>Your home starts here.</h1><p>Draw your first room. Make the rest your own.</p><span>Drag to draw a rectangle, or choose a custom outline</span></div>}
<div className="game-canvas-controls"><SketchFrame/><RulerMarks/><IconButton title="Undo (Ctrl+Z)" icon={Undo2} disabled={!history.past.length||!editable} onClick={undo}/><IconButton title="Redo (Ctrl+Shift+Z)" icon={Redo2} disabled={!history.future.length||!editable} onClick={redo}/><span className="control-divider"/><IconButton title="Show placement grid" icon={Grid2X2} active={home.grid} disabled={!buildable} onClick={()=>commit(h=>({...h,grid:!h.grid}))}/><span className="control-divider"/><IconButton title="Zoom out" icon={Minus} disabled={zoom<=.2} onClick={()=>adjustZoom(-1)}/><button className="zoom-value" title="Reset view" onClick={()=>{setZoom(1);setCamera({x:0,y:0});}}>{Math.round(zoom*100)}%</button><IconButton title="Zoom in" icon={Plus} disabled={zoom>=3} onClick={()=>adjustZoom(1)}/><span className="control-divider"/><IconButton title="Full screen" icon={Expand} onClick={()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.().catch(()=>notify('Full screen is unavailable in this browser.'));}}/></div>
        {mode==='build'&&<div className="plan-scale"><span/><small>1 m</small><span>TOP VIEW / LEVEL {activeLevel}</span></div>}
        {mode==='build'&&selectedWallData&&tool==='select'&&<div className="wall-inspector" role="region" aria-label="Wall settings"><strong>Wall settings</strong><label>Width <input type="range" min="3" max="20" step="1" value={selectedWallData.thickness||7} onChange={e=>commit(h=>setWallThickness(h,selectedWallData.id,e.target.value))}/><span>{selectedWallData.thickness||7}</span></label><button onClick={()=>commit(h=>setWallThickness(h,selectedWallData.id,7))}>Reset default</button></div>}
        {mode==='build'&&(selectedWall||groupCount>0)&&tool==='select'&&<div className="wall-edit-panel"><Move size={15}/><span>{canResizeOutline?'Drag a floor edge or box corner to resize; Shift keeps proportions':groupCount>1?groupCount+' selected - drag to move':'Drag to move; Shift-click to add'}</span><span className="delete-key-hint"><kbd>Backspace</kbd> delete</span></div>}
      </section>

      {mode!=='build'&&<aside id="furnish-drawer" className={`library-panel ${panelOpen?'is-open':''}`} aria-label={mode==='decorate'?'Furnish your home':'At home'} aria-hidden={!panelOpen} inert={!panelOpen}><SketchFrame/><IconButton className="close-library" title="Close panel" icon={X} onClick={()=>setPanelOpen(false)}/><div className="library-scroll">
        {mode==='explore'?<>
          <div className="panel-heading"><span className="panel-illustration"><Coffee size={26} strokeWidth={1.5}/></span><div><span className="eyebrow">TAKE YOUR TIME</span><h2>You’re home.</h2></div></div><p className="panel-description">Nothing to do. Nowhere to be.<br/>Just a little place to call your own.</p><div className="explore-card"><svg viewBox="0 0 150 140"><Character x={75} y={120} color={profile?.color}/><g fill="none" stroke="#a2b08b" strokeWidth="1.5"><path d="M31 69q-10-8-10 1 0 5 10 11 10-6 10-11 0-9-10-1M117 41v12m-6-6h12M31 32v8m-4-4h8"/></g></svg><h3>Make yourself at home</h3><p>Use <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys to wander. You can also click a spot to walk there.</p><span className="small-separator"/><p>Get close to something lovely, then press <kbd>E</kbd> to interact.</p></div><button className="button primary full-width" onClick={openNeighborhood}><DoorOpen size={18}/>A little fresh air<ArrowRight size={17}/></button><div className="explore-friends"><h3><Users size={17}/>At home with you<span>{players.length}</span></h3>{players.map(p=><div className="guest-line" key={p.connectionId}><span className="mini-avatar" style={{background:p.color}}>•ᴗ•</span><span>{p.name}{p.id===profile?.id&&<small> (that’s you)</small>}</span><span className="online-dot"/></div>)}{players.length<2&&<p>Lovely things are better together.<br/><button className="text-button" onClick={openInvite}>Invite a friend to stay a while<ArrowRight size={14}/></button></p>}</div>
        </>:<>
          <div className="panel-heading"><span className="panel-illustration">{shelf==='finishes'?<Wallpaper size={27} strokeWidth={1.5}/>:<Armchair size={27} strokeWidth={1.5}/>}</span><div><span className="eyebrow">MAKE YOURSELF AT HOME</span><h2>{shelf==='finishes'?'Floors & walls':'Your collection'}</h2></div></div>
          <div className="shelf-tabs" role="tablist" aria-label="Furnish categories" onKeyDown={e=>{const tabs=[...e.currentTarget.querySelectorAll('[role="tab"]')],at=tabs.indexOf(e.target),next=e.key==='ArrowRight'?(at+1)%tabs.length:e.key==='ArrowLeft'?(at+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(next!==null){e.preventDefault();tabs[next].focus();tabs[next].click();}}}>{[{id:'collection',name:'Collection'},{id:'stickers',name:'My stickers'},{id:'finishes',name:'Finishes'}].map(t=><button key={t.id} role="tab" id={`shelf-${t.id}`} aria-controls="shelf-content" aria-selected={shelf===t.id} tabIndex={shelf===t.id?0:-1} className={shelf===t.id?'active':''} onClick={()=>setShelf(t.id)}>{t.name}</button>)}</div>
          <div id="shelf-content" role="tabpanel" aria-labelledby={`shelf-${shelf}`}>
          {shelf==='finishes'?<Finishes home={home} commit={commit} canEdit={buildable}/>:<>
            <p className="panel-description">Pick a piece to place in your home.</p>
            <label className="search-field"><Search size={16}/><input aria-label="Find something lovely" placeholder="Find something lovely…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>}</label>
            {shelf==='collection'&&<div className="category-chips">{CATEGORIES.map(({name,icon:Icon})=><button key={name} className={category===name?'active':''} onClick={()=>setCategory(name)}><Icon size={13} strokeWidth={1.7}/>{name}</button>)}</div>}
            <div className="catalog-section-label"><span>{shelf==='stickers'?'YOUR UPLOADS':category==='All pieces'?'ALL FURNITURE':category.toUpperCase()}</span><span>{libraryItems.length} pieces</span></div>
            <div className="furniture-catalog">
              {libraryItems.map(item=><FurnitureCard key={item.type} item={item} selected={selectedItem?.type===item.type} editable={editable} onPlace={()=>addItem(item.type)} onRename={()=>openRenameSticker(item)}/>)}
              {!libraryItems.length&&<div className="catalog-empty"><Leaf/><h3>{shelf==='stickers'?'A little room for you':'Nothing here just yet'}</h3><p>{shelf==='stickers'?'Turn your favorite pictures into one-of-a-kind stickers.':'Try another search or category.'}</p>{shelf==='stickers'&&<button className="text-button" onClick={()=>fileRef.current.click()}>Add your first sticker<Plus size={14}/></button>}</div>}
            </div>
            <button className="upload-card" onClick={()=>editable?fileRef.current.click():notify('Ask the homeowner for decorating permission first.')}><span className="upload-icon"><ImagePlus size={24} strokeWidth={1.5}/></span><span><strong>From your photos</strong><small>Upload a photo. Make it a sticker.</small></span><Plus size={17}/></button>
            <div className="shelf-footnote"><LeafIcon size={13}/>Collected for your home.</div>
          </>}
          </div>
        </>}
        {selectedItem&&mode==='decorate'&&<div className="selection-inspector"><div className="inspector-heading"><span><span className="selection-dot"/>{selectedMeta?.name||'Your little treasure'}</span><IconButton title="Deselect piece" icon={X} onClick={()=>setSelected(null)}/></div><div className="inspector-actions"><IconButton title="Bring forward" icon={ArrowUp} disabled={selectedItem.locked} onClick={()=>moveLayer(1)}/><IconButton title="Send backward" icon={ArrowDown} disabled={selectedItem.locked} onClick={()=>moveLayer(-1)}/><IconButton title={selectedItem.locked?'Unlock piece':'Lock piece'} icon={LockKeyhole} active={selectedItem.locked} onClick={()=>modifyItem(selected,{locked:!selectedItem.locked})}/><label>Size<input type="range" aria-label="Furniture size" min=".2" max="3" step=".05" disabled={selectedItem.locked} value={selectedItem.scale} onChange={e=>modifyItem(selected,{scale:Number(e.target.value)})}/><span>{Math.round(selectedItem.scale*100)}%</span></label></div></div>}
      </div></aside>}
    </main>}

    {page==='neighborhood'&&<Neighborhood homes={neighborhood} profile={profile} players={world.streetPlayers} send={world.send} loading={loadingNeighbors} onEnter={enterFromStreet} onBuild={returnHome}/>}

    {page==='stickers'&&<main className="stickerbook-page"><div className="stickerbook-header"><div><span className="eyebrow">SAVED FOR A RAINY DAY, OR ANY DAY</span><h2>A book full of possibilities.</h2><p>Pick a piece, give it a home. There’s no wrong way to make it yours.</p></div><button className="button primary" onClick={()=>fileRef.current.click()}><Upload size={17}/>Add a personal sticker</button></div><div className="stickerbook-filters"><label className="search-field"><Search size={17}/><input placeholder="A plant, a cozy chair, a favorite thing…" aria-label="Search sticker book" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="category-chips">{[{name:'All pieces',icon:Grid2X2},...CATEGORIES.slice(1),{name:'My stickers',icon:Heart}].map(({name,icon:Icon})=><button key={name} className={(name==='My stickers'?customTab:!customTab&&category===name)?'active':''} onClick={()=>{setCategory(name==='My stickers'?'All pieces':name);setCustomTab(name==='My stickers');}}><Icon size={14}/>{name}</button>)}</div></div><div className="stickerbook-grid">{displayItems.map(item=><article className="book-piece" key={item.type}><div className="book-piece-art"><TopDownPreview type={item.type} custom={item.src?item:null}/><span className="piece-category">{item.category}</span></div><h3>{item.name}</h3><p>{item.tag}</p><div className="book-piece-actions"><button className="text-button" onClick={()=>addItem(item.type)}>Find a little spot<Plus size={15}/></button>{item.src&&<IconButton title={`Remove ${item.name} from sticker book`} icon={Trash2} onClick={()=>{commit(h=>({...h,custom:h.custom.filter(c=>c.id!==item.type),items:h.items.filter(i=>i.type!==item.type)}));notify('That sticker has been removed from your book and room.');}}/>}</div></article>)}{!displayItems.length&&<div className="catalog-empty"><Leaf/><h3>A little room for something special</h3><p>Upload a favorite photo or try another search.</p></div>}</div></main>}

    <div className="game-social" role="group" aria-label="Friends and neighborhood"><SketchFrame/><button title="Invite a friend" aria-label="Invite a friend" onClick={openInvite}><GameIcon kind="invite"/><span>Invite</span></button><button title="Neighborhood" aria-label="Neighborhood" onClick={openNeighborhood}><GameIcon kind="street"/><span>Street</span></button><button title="A little hello" aria-label="A little hello" aria-expanded={chatOpen} onClick={()=>setChatOpen(c=>!c)}><GameIcon kind="chat"/><span>Chat</span></button></div>
    {chatOpen&&<section className="chat-panel" aria-label="Home chat"><SketchFrame/><div className="chat-header"><span><MessageCircle size={17}/>A little hello</span><IconButton title="Close chat" icon={X} onClick={()=>setChatOpen(false)}/></div><div className="chat-messages" aria-live="polite">{!world.messages.length?<div className="chat-empty"><Coffee size={30} strokeWidth={1.3}/><p>Pull up a chair.<br/>Say hello to someone at home.</p></div>:world.messages.map(m=><div className="chat-message" key={m.id}><strong style={{color:m.color}}>{m.name}</strong><p>{m.text}</p></div>)}</div><form onSubmit={e=>{e.preventDefault();if(chatText.trim()){world.send({type:'chat',text:chatText});setChatText('');}}}><input placeholder="A friendly little hello…" aria-label="Chat message" maxLength={240} value={chatText} onChange={e=>setChatText(e.target.value)}/><IconButton title="Send message" icon={Send} disabled={!chatText.trim()} type="submit"/></form></section>}
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleUpload}/>
    {floorContext&&<div className="floor-context-menu" role="menu" aria-label="Floor-plan section" style={{left:floorContext.x,top:floorContext.y}}><SketchFrame/><span>Floor-plan section</span><button role="menuitem" onClick={()=>{chooseTool('select');setFloorContext(null);}}>Select & resize<span>V</span></button><button role="menuitem" onClick={()=>{commit(h=>deleteSelection(h,{...emptySelection(),sections:[floorContext.sectionId]}));setFloorContext(null);setSelection(emptySelection());setSelectedWall(null);}}>Delete floor-plan section<kbd>⌫</kbd></button></div>}
    {toast&&<div className="toast" role="status"><LeafIcon size={17}/><span>{toast}</span><button aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={14}/></button></div>}

    {modal==='rename'&&<Modal title="What feels like home?" eyebrow="GIVE YOUR LITTLE PLACE A NAME" onClose={closeModal}><p>A name for your own little corner of the world.</p><form onSubmit={e=>{e.preventDefault();if(formName.trim()){commit(h=>({...h,name:formName.trim().slice(0,80)}));setModal(null);}}}><label className="form-label">Your home’s name<input autoFocus maxLength={80} value={formName} onChange={e=>setFormName(e.target.value)} placeholder="My home"/></label><button className="button primary full-width" disabled={!formName.trim()}><Check size={17}/>That feels like home</button></form></Modal>}
    {modal==='profile'&&<Modal title="Hello, little dreamer." eyebrow="A LITTLE INTRODUCTION" onClose={closeModal}><p>What should your neighbors call you?</p><div className="profile-preview"><svg viewBox="0 0 130 120"><Character x={65} y={109} color={profileColor}/></svg></div><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await world.updateProfile({name:formName.trim(),color:profileColor});setModal(null);notify('Looking lovely. Make yourself at home.');}catch(err){notify(err.message);}finally{setBusy(false);}}}><label className="form-label">Your display name<input autoFocus required maxLength={24} value={formName} onChange={e=>setFormName(e.target.value)}/></label><label className="form-label">A favorite color</label><div className="profile-colors">{['#a2ad83','#bda080','#a0b6b1','#c29d9b','#b1a2bb','#cfb676'].map(c=><button type="button" key={c} title={`Outfit color ${c}`} aria-label={`Outfit color ${c}`} className={profileColor===c?'active':''} style={{background:c}} onClick={()=>setProfileColor(c)}>{profileColor===c&&<Check size={19}/>}</button>)}</div><button className="button primary full-width" disabled={busy||!formName.trim()}>{busy?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>}That’s a little more me</button></form></Modal>}
    {modal==='invite'&&<Modal title="A little company?" eyebrow="GOOD HOMES HAVE ROOM FOR FRIENDS" onClose={closeModal}><p>Invite someone to slow down, stay a while, and make a little memory.</p>{role==='owner'?<><label className="form-label">Give your friend a little freedom<select value={inviteRole} onChange={e=>{setInviteRole(e.target.value);setInviteLink('');}}><option value="viewer">Visitor — wander & enjoy</option><option value="decorator">Decorator — make it cozy together</option><option value="builder">Builder — dream & build together</option></select></label><button className="button primary full-width" onClick={createInvite} disabled={busy}>{busy?<LoaderCircle size={17} className="spin"/>:<Link size={17}/>}Make an invitation<Copy size={16}/></button>{inviteLink&&<label className="form-label invite-link-label">A link to your little place · valid for 7 days<input readOnly aria-label="Invitation link" value={inviteLink} onFocus={e=>e.target.select()}/></label>}<div className="public-setting"><span><DoorOpen size={21}/><span><strong>Leave the door open</strong><small>Let neighbors visit and look around.</small></span></span><button className={`toggle ${access.public?'on':''}`} role="switch" aria-checked={access.public} aria-label="Allow neighborhood visitors" onClick={()=>updateAccess({public:!access.public})}><span/></button></div>{access.collaborators.length>0&&<div className="collaborators"><h3>People with a little key</h3>{access.collaborators.map(p=><div className="collaborator" key={p.id}><span className="mini-avatar" style={{background:p.color}}>•ᴗ•</span><span>{p.name}</span><select aria-label={`Permission for ${p.name}`} value={p.role} onChange={e=>updateAccess({playerId:p.id,role:e.target.value})}><option value="viewer">Visitor</option><option value="decorator">Decorator</option><option value="builder">Builder</option><option value="remove">Remove access</option></select></div>)}</div>}</>:<div className="visitor-notice"><ShieldCheck size={28}/><h3>You’re a welcome {role==='viewer'?'visitor':role}.</h3><p>Only the homeowner can make invitations and change who has a key.</p></div>}<span className="modal-footnote"><LockKeyhole size={12}/>Your home. Your people. Your choice.</span></Modal>}
    {modal==='upload'&&<StickerDialog busy={busy} src={removeBg?upload?.processed:upload?.original} name={upload?.name||''} removeBg={removeBg} onRemoveBg={setRemoveBg} onName={name=>setUpload(u=>({...u,name}))} cancel={closeModal} save={saveUpload}/>}
    {editingStickerId&&home.custom.some(s=>s.id===editingStickerId)&&<StickerDialog renaming src={home.custom.find(s=>s.id===editingStickerId).src} name={editingStickerName} onName={setEditingStickerName} cancel={()=>setEditingStickerId(null)} save={saveStickerRename}/>}
    {modal==='help'&&<Modal title="A little guide to feeling at home." eyebrow="THERE’S NO WRONG WAY TO MAKE IT YOURS" wide onClose={closeModal}><div className="help-grid"><div><Hammer/><h3>Dream it. Draw it.</h3><p>Build straight walls or draw freeform curves. Use Home outline for a new floor shape. Select a wall to move it or drag its endpoints.</p></div><div><Armchair/><h3>A few favorite things.</h3><p>Click or drag a piece from the collection. Select it to resize, rotate, flip, layer, or lock it. Your changes save as you go.</p></div><div><DoorOpen/><h3>Settle right in.</h3><p>Switch to Explore. Wander with WASD or arrow keys. Walk up to a chair, your bed, or a little treasure, then press E.</p></div><div><Users/><h3>Better together.</h3><p>Invite a friend with a visitor, decorator, or builder pass. Open the same link on another device to walk and decorate together.</p></div></div><div className="help-note"><ShieldCheck size={19}/><p>Your home is linked to this browser. Keep your browser data to return to it. Use a backup to keep a personal copy.</p></div><button className="button secondary full-width" onClick={exportHome}><Download size={17}/>Keep a backup of my home</button></Modal>}
    {modal==='room'&&<Modal title="Your own cozy corner." eyebrow="A LITTLE PLACE TO JUST BE" onClose={closeModal}><p>{home.description}</p><div className="room-stats"><span><strong>{home.items.length}</strong>favorite things</span><span><strong>{home.walls.length}</strong>little walls</span><span><strong>{players.length}</strong>at home</span></div><p className="room-quote">“A home isn’t simply given to you.<br/>You make it yours.”</p><button className="button secondary full-width" onClick={()=>{setModal(null);openNeighborhood();}}><DoorOpen size={17}/>Meet the neighborhood<ArrowRight size={16}/></button></Modal>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
