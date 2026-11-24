// Decorations share one paint order. Architecture is deliberately not part of
// this list: even the lowest decoration stays above walls, windows and doors.
export function orderedObjects(home,{useLayers=true}={}){
  const objects=[...(home.stairs||[]).map(object=>({kind:'stair',object})),...home.items.map(object=>({kind:'item',object}))];
  if(!useLayers)return objects.sort((a,b)=>a.object.id.localeCompare(b.object.id));
  const saved=new Map((home.objectOrder||[]).map((id,index)=>[id,index]));
  return objects.map((entry,index)=>({...entry,index})).sort((a,b)=>(saved.get(a.object.id)??saved.size+a.index)-(saved.get(b.object.id)??saved.size+b.index));
}

export function reorderObjects(home,ids,direction,scopeIds){
  const chosen=new Set(ids),scope=scopeIds?new Set(scopeIds):null;
  const all=orderedObjects(home),local=all.filter(e=>!scope||scope.has(e.object.id));
  const selected=entry=>chosen.has(entry.object.id)&&!entry.object.locked;
  if(!local.some(selected))return home;
  if(direction==='forward'){
    for(let i=local.length-2;i>=0;i--)if(selected(local[i])&&!selected(local[i+1]))[local[i],local[i+1]]=[local[i+1],local[i]];
  }else if(direction==='backward'){
    for(let i=1;i<local.length;i++)if(selected(local[i])&&!selected(local[i-1]))[local[i],local[i-1]]=[local[i-1],local[i]];
  }else return home;
  let at=0;
  const order=all.map(e=>!scope||scope.has(e.object.id)?local[at++]:e);
  // Keep the legacy furniture array in paint order for older consumers, while
  // objectOrder also records where stairs sit relative to furniture/stickers.
  return {...home,objectOrder:order.map(e=>e.object.id),items:order.filter(e=>e.kind==='item').map(e=>e.object)};
}
