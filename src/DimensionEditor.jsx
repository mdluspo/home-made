import React,{useEffect,useRef,useState} from 'react';
import {SketchFrame} from './SketchFrame.jsx';

export function DimensionEditor({value,position,kind,onSave,onCancel}){
  const input=useRef(null),[text,setText]=useState(value.toFixed(2)),[error,setError]=useState('');
  useEffect(()=>{input.current?.focus();input.current?.select();},[]);
  useEffect(()=>{
    const outside=e=>{if(!e.target.closest('.dimension-editor,.editable-dimension-label'))onCancel();};
    document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);
  },[onCancel]);
  return <form className="dimension-editor" style={position} role="dialog" aria-label="Set exact measurement" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onCancel();}}} onSubmit={e=>{
    e.preventDefault();
    const parsed=/^\s*(?:\d+(?:[.,]\d*)?|[.,]\d+)\s*(?:m)?\s*$/i.test(text)?Number(text.trim().replace(/m$/i,'').trim().replace(',','.')):NaN;
    const message=onSave(parsed);if(message)setError(message);
  }}>
    <SketchFrame/><label htmlFor="exact-plan-measurement">Measurement</label>
    <div className="dimension-input-row"><input ref={input} id="exact-plan-measurement" aria-label="Measurement in metres" inputMode="decimal" value={text} onChange={e=>{setText(e.target.value);setError('');}} aria-invalid={!!error} aria-describedby={error?'measurement-error':'measurement-help'}/><span>m</span></div>
    <small id="measurement-help">{kind==='wall'?'Sets this wall’s length.':'Resizes the floor; does not morph its points.'}</small>
    {error&&<p id="measurement-error" role="alert">{error}</p>}
    <div className="dimension-editor-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="submit">OK</button></div>
  </form>;
}
