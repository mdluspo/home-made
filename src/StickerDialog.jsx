import React,{useEffect,useRef} from 'react';
import {Feather,LoaderCircle,Plus} from 'lucide-react';
import {TopDownPreview} from './TopDown.jsx';

export function StickerDialog({busy=false,src,name,onName,cancel,save,removeBg,onRemoveBg,renaming=false}){
  const dialog=useRef(null),input=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    (input.current||dialog.current)?.focus();
    return ()=>previous?.isConnected&&previous.focus();
  },[busy]);
  return <div className="sticker-upload-overlay"><form ref={dialog} className="sticker-upload-card" role="dialog" aria-modal="true" aria-label={renaming?'Rename sticker':'Name your sticker'} tabIndex={-1} onSubmit={e=>{e.preventDefault();if(!busy&&name.trim())save();}} onKeyDown={e=>{
    e.stopPropagation();
    if(e.key==='Escape'){e.preventDefault();cancel();}
    if(e.key==='Tab'){
      const controls=[...e.currentTarget.querySelectorAll('button:not(:disabled),input')],first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  }}>
    <div className="sticker-floating-preview">{busy?<LoaderCircle className="spin" aria-label="Preparing sticker"/>:<img src={src} alt="Sticker preview"/>}</div>
    <input ref={input} className="sticker-name-input" aria-label="Sticker name" placeholder="Name your sticker" required maxLength={40} value={name} disabled={busy} onChange={e=>onName(e.target.value)}/>
    {onRemoveBg&&<label className="sticker-upload-options"><input type="checkbox" checked={removeBg} onChange={e=>onRemoveBg(e.target.checked)}/><span>Remove background</span></label>}
    <div className="sticker-upload-actions"><button type="button" className="button secondary" onClick={cancel}>Cancel</button><button type="submit" className="button primary" disabled={busy||!name.trim()}>OK</button></div>
  </form></div>;
}

// The rename action is a sibling of the placement button, never nested inside
// it. Its fixed width is reserved before the name is ellipsized.
export function FurnitureCard({item,selected,editable,onPlace,onRename}){
  return <article className={`furniture-card ${selected?'selected':''}`}>
    <button type="button" className="furniture-place-button" disabled={!editable} draggable={editable} onDragStart={e=>{e.dataTransfer.setData('application/home-made',item.type);e.dataTransfer.effectAllowed='copy';}} onClick={onPlace} title={`${item.name} — click to place, or drag into your room`}>
      <span className="furniture-card-art"><TopDownPreview type={item.type} custom={item.src?item:null}/><span className="add-piece"><Plus size={13}/></span></span>
    </button>
    <div className="furniture-name-row"><button type="button" className="furniture-name" title={item.name} disabled={!editable} onClick={onPlace}>{item.name}</button>{item.src&&<button className="sticker-rename-button" type="button" title={`Rename ${item.name}`} aria-label={`Rename ${item.name}`} disabled={!editable} onClick={onRename}><Feather size={14}/></button>}</div>
    <span className="furniture-subtitle">{item.tag}</span>
  </article>;
}
