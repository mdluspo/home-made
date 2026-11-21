import React,{useEffect,useRef,useState} from 'react';
import { ArrowLeft, ArrowRight, DoorOpen, Hammer, LoaderCircle, Wind } from 'lucide-react';
import { Character,Cottage } from './Art.jsx';

function Tree({x,y,scale=1}){
  return <g transform={`translate(${x} ${y}) scale(${scale})`} stroke="#82946c" strokeWidth="2" strokeLinejoin="round"><path d="M-8 0-5-105H8L12 0" fill="#b5a47f"/><path d="M-6-53-28-81m34 8 22-23" fill="none"/><path d="M-39-90q-47-30-12-65-8-46 37-43 24-40 54-5 52-8 43 38 44 36-4 67-13 24-37 6-46 21-81 2" fill="#b7c796"/><path d="M-39-127q8 7 20 4m46-35 17 3m-37 44 10 6" fill="none" stroke="#a0b383"/></g>;
}
export function Neighborhood({homes,profile,players,send,loading,onEnter,onBuild}){
  const count=Math.max(6,...homes.map(h=>(h.lotIndex||0)+2),(profile?.lotIndex||0)+2);
  const [position,setPosition]=useState({x:(profile?.lotIndex||0)*360+180,y:580});
  const held=useRef(new Set()),latest=useRef(position),svgRef=useRef();latest.current=position;
  const maxX=count*360,camera=Math.max(0,Math.min(maxX-1080,position.x-540));
  const nearbyIndex=Math.floor(position.x/360),nearby=homes.find(h=>h.lotIndex===nearbyIndex),isOwn=nearbyIndex===(profile?.lotIndex||0);
  useEffect(()=>{
    const down=e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(['a','d','w','s','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();held.current.add(e.key.toLowerCase());}};
    const up=e=>held.current.delete(e.key.toLowerCase()),clear=()=>held.current.clear();
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);
    let frame,last=performance.now(),sent=0;
    const tick=t=>{const dt=Math.min((t-last)/1000,.04);last=t;const ks=held.current;
      if(ks.size){const x=Number(ks.has('d')||ks.has('arrowright'))-Number(ks.has('a')||ks.has('arrowleft')),y=Number(ks.has('s')||ks.has('arrowdown'))-Number(ks.has('w')||ks.has('arrowup'));const p={x:Math.max(40,Math.min(maxX-40,latest.current.x+x*dt*190)),y:Math.max(530,Math.min(650,latest.current.y+y*dt*140))};latest.current=p;setPosition(p);if(t-sent>60){send({type:'streetmove',...p});sent=t;}}
      frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);};
  },[maxX,send]);
  useEffect(()=>{const down=e=>{if(e.key.toLowerCase()==='e'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){if(nearby?.canVisit)onEnter(nearby);else if(isOwn&&!nearby)onBuild();}};window.addEventListener('keydown',down);return()=>window.removeEventListener('keydown',down);},[nearby,isOwn,onEnter,onBuild]);
  const walkBy=delta=>{const p={x:Math.max(40,Math.min(maxX-40,position.x+delta)),y:position.y};setPosition(p);send({type:'streetmove',...p});};
  return <section className="street-game" aria-label="Neighborhood street">
    <svg className="street-scene" ref={svgRef} viewBox={`${camera} 0 1080 760`} aria-label="A neighborhood with player-built homes and empty lots" onPointerDown={e=>{if(e.button!==0)return;const p=svgRef.current.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const at=p.matrixTransform(svgRef.current.getScreenCTM().inverse());if(at.y>=510){const next={x:Math.max(40,Math.min(maxX-40,at.x)),y:Math.max(530,Math.min(650,at.y))};setPosition(next);send({type:'streetmove',...next});}}}>
      <defs><pattern id="street-grass" width="120" height="78" patternUnits="userSpaceOnUse"><path d="m12 34 3-5 2 6m57 22 3-5 3 6m26-54 2-4 3 4" fill="none" stroke="#a3b88a" strokeWidth="1.2" opacity=".5"/></pattern></defs>
      <rect x="-100" width={maxX+200} height="760" fill="#e8eddb"/>
      <path d={`M-100 280Q200 190 500 260T1200 245T2000 270T${maxX+200} 240V760H-100Z`} fill="#d3dfbd" stroke="none"/>
      <rect x="-100" y="330" width={maxX+200} height="430" fill="#cbd9b2"/>
      <rect x="-100" y="330" width={maxX+200} height="430" fill="url(#street-grass)"/>
      {Array.from({length:count+1},(_,i)=><Tree key={i} x={i*360+20} y={440} scale={.7+(i%3)*.07}/>)}
      <path d={`M-100 530Q400 516 900 530T${maxX+200} 530V670Q1600 650 900 665T-100 670Z`} fill="#e2d5ad" stroke="#bdc199" strokeWidth="2"/>
      <path d={`M-100 600H${maxX+200}`} stroke="#cfc79f" strokeWidth="2" strokeDasharray="13 38" opacity=".5"/>
      {Array.from({length:count},(_,i)=>{const h=homes.find(h=>h.lotIndex===i),x=i*360,own=i===(profile?.lotIndex||0);return <g key={i} className={h?'occupied-lot':'unbuilt-lot'}>
        {h?<><svg x={x+28} y="253" width="300" height="270" viewBox="0 0 300 270"><Cottage color={h.owner.color}/></svg><g transform={`translate(${x+180} 512)`}><rect x="-115" y="-14" width="230" height="29" rx="7" fill="#f8f3de" stroke="#9eac88" strokeWidth="1.5"/><text textAnchor="middle" y="4" fontSize="12" fill="#81916e" fontFamily="Gaegu, cursive">{h.name}</text></g></>:<><path d={`M${x+67} 440H${x+291}V495H${x+67}Z`} fill="#c5d5a8" stroke="#a6ba8c" strokeWidth="1.5" strokeDasharray="6 8"/><g transform={`translate(${x+180} 425) rotate(${i%2?3:-3})`} stroke="#879773" strokeWidth="2" strokeLinejoin="round"><path d="M-5 22V79h9V22" fill="#b3a079"/><rect x="-52" y="-16" width="104" height="55" rx="4" fill="#eee3bf"/><path d="M-45-9h90v41h-90z" fill="none" stroke="#d3c79e" strokeWidth="1"/><text textAnchor="middle" y="8" fill="#81916a" stroke="none" fontFamily="Gaegu, cursive" fontSize={own?17:23} fontWeight="700">{own?'YOUR EMPTY LOT':'FOR SALE'}</text><text textAnchor="middle" y="24" fill="#a5a47e" stroke="none" fontFamily="DM Sans,sans-serif" fontSize="6" letterSpacing="1.3">{own?'BUILD SOMETHING YOURS':'A LITTLE POSSIBILITY'}</text></g></>}
        <text x={x+180} y="710" textAnchor="middle" fontSize="10" letterSpacing="3" fill="#9eb18a" fontFamily="Gaegu,cursive">{String(i+1).padStart(2,'0')} CLOVER LANE</text>
      </g>;})}
      {players.filter(p=>p.id!==profile?.id&&p.position).map(p=><Character key={p.connectionId} {...p.position} color={p.color} name={p.name}/>)}
      <Character {...position} color={profile?.color} name={profile?.name}/>
    </svg>
    <div className="street-place-name"><Wind size={18}/><span>Clover Lane<small>{homes.length?`${homes.length} player-built ${homes.length===1?'home':'homes'}`:'A quiet street. No homes built yet.'}</small></span></div>
    {loading&&<span className="street-loading"><LoaderCircle className="spin" size={17}/></span>}
    <div className="street-walk-controls"><button aria-label="Walk left" onClick={()=>walkBy(-140)}><ArrowLeft size={21}/></button><span><kbd>A</kbd><kbd>D</kbd> or arrow keys to wander</span><button aria-label="Walk right" onClick={()=>walkBy(140)}><ArrowRight size={21}/></button></div>
    {(nearby||isOwn)&&<button className="street-enter" disabled={nearby&&!nearby.canVisit} onClick={()=>nearby?onEnter(nearby):onBuild()}>{nearby?<DoorOpen size={18}/>:<Hammer size={18}/>}<kbd>E</kbd>{nearby?(nearby.canVisit?nearby.owner.id===profile?.id?'Home, sweet home':'Enter home':'By invitation'):'Build your home'}</button>}
  </section>;
}
