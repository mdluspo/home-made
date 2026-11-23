// All geometry is local and UNSCALED. Apply x/y, rotation and scale at the caller.
export const STAIR_TYPES = [
  {id:'straight', name:'Straight'},
  {id:'single-winder', name:'Single winder'},
  {id:'double-winder', name:'Double winder'},
  {id:'spiral', name:'Spiral'},
  {id:'half-landing', name:'Half landing U'},
  {id:'quarter-landing', name:'Quarter landing L'},
];

const point = (x,y) => ({x,y});
const rect = (x,y,w,h) => [point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)];
const polar = (cx,cy,r,a) => point(cx+r*Math.cos(a),cy+r*Math.sin(a));
const sampleArc = (cx,cy,r,a,b,n) => Array.from({length:n+1},(_,i)=>polar(cx,cy,r,a+(b-a)*i/n));
const kindOf = stair => STAIR_TYPES.some(t=>t.id===stair?.kind) ? stair.kind : 'straight';

// Shared mesh keeps outline, sprite, selection bounds and cutout in agreement.
export function stairGeometry(stair) {
  const kind=kindOf(stair), steps=[], rails=[];
  const add = points => {const z=(steps.length+1)*2;steps.push({points,z});return z;};
  const rail = points => rails.push(points.map(([x,y,z])=>({x,y,z})));
  const flight = (x1,y1,x2,y2,width,count=6) => {
    const dx=(x2-x1)/count,dy=(y2-y1)/count,length=Math.hypot(dx,dy);
    const nx=-dy/length*width/2,ny=dx/length*width/2;
    for(let i=0;i<count;i++) {
      const a=point(x1+dx*i,y1+dy*i),b=point(a.x+dx,a.y+dy);
      add([point(a.x+nx,a.y+ny),point(b.x+nx,b.y+ny),point(b.x-nx,b.y-ny),point(a.x-nx,a.y-ny)]);
    }
  };
  // Three square winders per quarter turn. Include the outside square corner
  // inside the middle tread, rather than replacing the turn with a curved fan.
  const wind = (cx,cy,width,start) => {
    const edge = a => polar(cx,cy,width/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a))),a);
    for(let i=0;i<3;i++) {
      const a=start+i*Math.PI/6,b=a+Math.PI/6,angles=[a];
      for(let k=-8;k<=8;k++) {const c=Math.PI/4+k*Math.PI/2;if(c>a+1e-8&&c<b-1e-8)angles.push(c);}
      angles.push(b);add([point(cx,cy),...angles.map(edge)]);
    }
  };
  let footprint;
  if(kind==='straight') {
    footprint=rect(-24,-56,48,112);
    flight(0,56,0,-56,48,10);
    for(const x of [-24,24])rail([[x,56,2],[x,-56,20]]);
  } else if(kind==='spiral') {
    const n=14,cx=0,cy=31,inner=14,outer=62;
    footprint=[...sampleArc(cx,cy,outer,Math.PI,2*Math.PI,42),...sampleArc(cx,cy,inner,2*Math.PI,Math.PI,42)];
    for(let i=0;i<n;i++) {
      const a=Math.PI+i*Math.PI/n,b=a+Math.PI/n;
      add([...sampleArc(cx,cy,outer,a,b,3),...sampleArc(cx,cy,inner,b,a,3)]);
    }
    for(const r of [inner,outer])rails.push(sampleArc(cx,cy,r,Math.PI,2*Math.PI,n*3).map((p,i)=>({...p,z:2+26*i/(n*3)})));
  } else if(kind==='single-winder'||kind==='quarter-landing') {
    footprint=[point(-56,56),point(-16,56),point(-16,-16),point(56,-16),point(56,-56),point(-56,-56)];
    flight(-36,56,-36,-16,40);
    if(kind==='single-winder')wind(-16,-16,40,Math.PI);
    else add(rect(-56,-56,40,40));
    const turn=steps.length*2;
    flight(-16,-36,56,-36,40);
    rail([[-56,56,2],[-56,-16,12],[-56,-56,(12+turn)/2],[-16,-56,turn],[56,-56,turn+12]]);
    rail([[-16,56,2],[-16,-16,12]]);
    rail([[-16,-16,turn],[56,-16,turn+12]]);
  } else {
    footprint=[point(-50,60),point(-6,60),point(-6,-16),point(6,-16),point(6,60),point(50,60),point(50,-60),point(-50,-60)];
    flight(-28,60,-28,-16,44);
    if(kind==='double-winder') {
      wind(-6,-16,44,Math.PI);
      add(rect(-6,-60,12,44));
      wind(6,-16,44,Math.PI*1.5);
    } else add(rect(-50,-60,100,44));
    const turn=steps.length*2;
    flight(28,-16,28,60,44);
    rail([[-50,60,2],[-50,-16,12],[-50,-60,kind==='double-winder'?16:14],[50,-60,kind==='double-winder'?22:14],[50,-16,turn],[50,60,turn+12]]);
    rail([[-6,60,2],[-6,-16,12]]);
    rail([[6,-16,turn],[6,60,turn+12]]);
    if(kind==='half-landing')rail([[-6,-16,14],[6,-16,14]]);
  }
  return {kind,footprint,steps,rails};
}

// One simple local ring per stair; the spiral preserves its open central notch.
// These are suitable for hole unioning after applying the stair's world transform.
export function stairPolygons(stair) {
  return [stairGeometry(stair).footprint.map(p=>({...p}))];
}

export function stairBounds(stair,{decorated=false}={}) {
  const {footprint,steps,rails}=stairGeometry(stair);
  const points=[...footprint];
  if(decorated) {
    for(const step of steps)for(const p of step.points)points.push(point(p.x,p.y-step.z),point(p.x,p.y-step.z+2));
    for(const rail of rails)for(const p of rail)points.push(point(p.x,p.y-p.z-12));
    // Three blur sigmas plus the ground shadow's (3,6) offset.
    for(const p of footprint)points.push(point(p.x-6,p.y-3),point(p.x+12,p.y+15));
  }
  const x=Math.min(...points.map(p=>p.x))-2,y=Math.min(...points.map(p=>p.y))-2;
  return {x,y,width:Math.max(...points.map(p=>p.x))+2-x,height:Math.max(...points.map(p=>p.y))+2-y};
}
