// Editable controls and sampled geometry stay separate. Crossing another
// divider must never split the placed object or create extra control points.
export const dividerId=wall=>wall.id.replace(/(?:~split\d+)+$/,'');
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const quadratic=(a,c,b,t)=>({x:(1-t)**2*a.x+2*(1-t)*t*c.x+t*t*b.x,y:(1-t)**2*a.y+2*(1-t)*t*c.y+t*t*b.y});
export function dividerPoints(wall){
  const points=wall.curved&&wall.curveMode==='three-point'?dividerControls(wall):wall.points;
  if(!wall.curved||points.length<3)return points;
  if(wall.curveMode==='three-point'){
    const [a,m,b]=points,c={x:2*m.x-(a.x+b.x)/2,y:2*m.y-(a.y+b.y)/2};
    const steps=2*Math.ceil(Math.max(16,Math.min(128,Math.ceil((Math.hypot(c.x-a.x,c.y-a.y)+Math.hypot(b.x-c.x,b.y-c.y))/5)))/2);
    return Array.from({length:steps+1},(_,i)=>quadratic(a,c,b,i/steps));
  }
  const sampled=[points[0]];let start=points[0];
  for(let i=1;i<points.length-1;i++){
    const end=midpoint(points[i],points[i+1]);
    for(let j=1;j<=4;j++)sampled.push(quadratic(start,points[i],end,j/4));
    start=end;
  }
  sampled.push(points.at(-1));return sampled;
}
export const dividerPolylines=wall=>wall.curveMode==='three-point'&&wall.points.length!==3?[dividerPoints(wall)]:wall.paths||[dividerPoints(wall)];
export const dividerPath=wall=>dividerPolylines(wall).map(points=>'M'+points.map(p=>`${p.x},${p.y}`).join(' L')).join(' ');
export function dividerControls(wall){
  if(!wall.curved)return [wall.points[0],wall.points.at(-1)];
  if(wall.curveMode==='three-point'){
    const points=wall.points;if(points.length===3||points.length<2)return points;
    const a=points[0],b=points.at(-1),dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    let middle=midpoint(a,b),distance=.05;
    // Older normalizers inserted crossing/clipping points into this list.
    // Keep the actual endpoints, discard redundant collinear samples, and
    // retain the bend rather than interpreting the third sample as the end.
    for(const p of points.slice(1,-1)){
      const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
      const d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
      if(d>distance){middle=p;distance=d;}
    }
    return [a,middle,b];
  }
  const samples=dividerPoints(wall);return [samples[0],samples[Math.floor(samples.length/2)],samples.at(-1)];
}
export function withDividerPoints(wall,points){
  const {paths,...rest}=wall;return {...rest,points};
}
