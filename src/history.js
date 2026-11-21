export const HISTORY_LIMIT=200;
export const recordHistory=(history,state)=>({past:[...history.past.slice(-(HISTORY_LIMIT-1)),state],future:[]});
export function travelHistory(history,current,direction){
  if(direction==='undo')return history.past.length?{state:history.past.at(-1),history:{past:history.past.slice(0,-1),future:[current,...history.future]}}:null;
  return history.future.length?{state:history.future[0],history:{past:[...history.past,current],future:history.future.slice(1)}}:null;
}
