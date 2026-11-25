import React from 'react';
import {RotateCcw} from 'lucide-react';
import {WOOD_FINISHES,FABRIC_FINISHES} from './design.js';

export function FinishPicker({item,disabled,onChange}){
  const groups=[...(!['rug','fridge','stove','books','kettle'].includes(item.type)?[{key:'wood',name:'Wood finish',values:WOOD_FINISHES}]:[]),...(['sofa','chair','bed','rug','lamp','fridge','stove','books','kettle'].includes(item.type)?[{key:'fabric',name:'Fabric / accent',values:FABRIC_FINISHES}]:[])];
  return <div className="finish-picker" role="group" aria-label="Furniture finishes"><strong>Make it yours</strong>{groups.map(group=><div key={group.key}><span>{group.name}</span><div className="finish-swatches">{group.values.map(f=><button key={f.id} type="button" title={f.name} aria-label={f.name} aria-pressed={item.finish?.[group.key]===f.id} disabled={disabled} className={item.finish?.[group.key]===f.id?'active':''} style={{background:f.color}} onClick={()=>onChange({finish:{...item.finish,[group.key]:f.id}})}/>)}</div></div>)}<button className="text-button" type="button" disabled={disabled} onClick={()=>onChange({finish:{}})}><RotateCcw size={13}/>Original colors</button></div>;
}

