import clipping from 'polygon-clipping';
import {distanceToSegment,floorOutlines} from './model.js';

export const WALL_HEIGHT=70,CUTAWAY_HEIGHT=0;
const EPS=.00001;
const snap=n=>Math.round(n*10000)/10000;
const polygon=points=>[points.map(p=>[snap(p.x),snap(p.y)])];
const snapped=geometry=>geometry.map(poly=>poly.map(ring=>ring.map(([x,y])=>[snap(x),snap(y)])));
const area=ring=>ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p.x*q.y-q.x*p.y;},0);
const bounds=geometry=>{
  const points=geometry.flat(2),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
};
const overlaps=(a,b)=>a.left<b.right-EPS&&a.right>b.left+EPS&&a.top<b.bottom-EPS&&a.bottom>b.top+EPS;
const heightAt=(plane,x,y)=>plane[0]*x+plane[1]*y+plane[2];
// Only the bottom-facing exterior is cut away. Side walls (including steep
// polygon/curve segments) and every interior divider keep their full height.
const wallHeight=(a,b,exterior)=>{
  const dx=b.x-a.x,dy=b.y-a.y;
  return exterior&&dx<0&&Math.abs(dx)>=Math.abs(dy)?CUTAWAY_HEIGHT:WALL_HEIGHT;
};
function alignedContour(ring){
  const points=ring.map(p=>({...p})),n=points.length;
  // Build's thick stroke hides sub-pixel joins and tiny parallel steps. Align
  // those same runs before extrusion so they cannot become raised ledges.
  for(let pass=0;pass<3;pass++)for(let i=0;i<n;i++){
    const p=points[(i+n-1)%n],a=points[i],b=points[(i+1)%n],q=points[(i+2)%n];
    if(Math.hypot(b.x-a.x,b.y-a.y)>4)continue;
    const ax=a.x-p.x,ay=a.y-p.y,bx=q.x-b.x,by=q.y-b.y,al=Math.hypot(ax,ay),bl=Math.hypot(bx,by);
    if(Math.min(al,bl)<24||Math.abs(ax*by-ay*bx)/(al*bl)>.005||(ax*bx+ay*by)<=0)continue;
    const origin=al>=bl?p:b,ux=(al>=bl?ax:bx)/(al>=bl?al:bl),uy=(al>=bl?ay:by)/(al>=bl?al:bl);
    for(const at of [p,a,b,q]){const t=(at.x-origin.x)*ux+(at.y-origin.y)*uy;at.x=origin.x+t*ux;at.y=origin.y+t*uy;}
  }
  return points;
}
function contourHeights(points){
  const n=points.length,heights=points.map((a,i)=>wallHeight(a,points[(i+1)%n],true));
  // A few shaky samples on an open front must not create a lone tall post.
  for(let i=0;i<n;i++){
    if(heights[i]!==WALL_HEIGHT||heights[(i+n-1)%n]!==CUTAWAY_HEIGHT)continue;
    const run=[];let j=i,length=0;
    while(run.length<n&&heights[j]===WALL_HEIGHT){run.push(j);length+=Math.hypot(points[(j+1)%n].x-points[j].x,points[(j+1)%n].y-points[j].y);j=(j+1)%n;}
    if(length<36&&heights[j]===CUTAWAY_HEIGHT)for(const k of run)heights[k]=CUTAWAY_HEIGHT;
  }
  return heights;
}
function strip({a,b,thickness,footprint}){
  if(footprint)return polygon(footprint);
  const length=Math.hypot(b.x-a.x,b.y-a.y),half=thickness/2;
  const ux=(b.x-a.x)/length*half,uy=(b.y-a.y)/length*half,nx=-uy,ny=ux;
  return polygon([{x:a.x-ux+nx,y:a.y-uy+ny},{x:b.x+ux+nx,y:b.y+uy+ny},{x:b.x+ux-nx,y:b.y+uy-ny},{x:a.x-ux-nx,y:a.y-uy-ny}]);
}
function frontHalfPlane(box,plane){
  let points=[{x:box.left-1,y:box.top-1},{x:box.right+1,y:box.top-1},{x:box.right+1,y:box.bottom+1},{x:box.left-1,y:box.bottom+1}];
  const result=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=heightAt(plane,a.x,a.y)-EPS,db=heightAt(plane,b.x,b.y)-EPS;
    if(da>=0)result.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
  }
  return result.length>2?polygon(result):null;
}
// A projected surface retains its original floor-plan depth. A doorway cuts
// only the solid at that depth, never a different wall overlapping it on screen.
function openingCutout(surface,opening){
  // A window/door in the cutaway front belongs to that low border only. Its
  // shallow cutout volume may touch a diagonal's base at a corner, but must
  // never punch a rectangular notch into the adjoining full-height wall.
  if(opening.height<=18&&surface.height>CUTAWAY_HEIGHT)return [];
  const angle=(opening.angle||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),d=surface.plane;
  const along=[c+s*d[0],s*d[1],s*d[2]-c*opening.x-s*opening.y];
  const across=[-s+c*d[0],c*d[1],c*d[2]+s*opening.x-c*opening.y];
  const elevation=[d[0],d[1]-1,d[2]],half=opening.thickness/2+1;
  const bottom=opening.height>18?(opening.type==='window'?12:-1):-10;
  const side=Math.abs(c)<.15;
  const top=opening.height>18?(side?opening.height+1:opening.height-8):12;
  const above=(plane,min)=>[plane[0],plane[1],plane[2]-min];
  const below=(plane,max)=>[-plane[0],-plane[1],max-plane[2]];
  let cutout=surface.original;
  const openingHalf=(opening.type==='window'?(opening.windowSpan||42):(opening.doorSpan||42))/2;
  for(const plane of [above(along,-openingHalf),below(along,openingHalf),above(across,-half),below(across,half),above(elevation,bottom),below(elevation,top)]){
    const region=frontHalfPlane(surface.bounds,plane);
    if(!region)return [];
    cutout=snapped(clipping.intersection(cutout,region));
    if(!cutout.length)return [];
  }
  return cutout;
}

export function roomOpenings(home,edges){
  return (home.openings||[]).map(opening=>{
    const wall=edges.reduce((best,edge,index)=>{
      const a=edge.planA||edge.a,b=edge.planB||edge.b,distance=distanceToSegment(opening,a,b);
      const aligned=Math.abs(Math.cos(Math.atan2(b.y-a.y,b.x-a.x)-(opening.angle||0)*Math.PI/180))>.96;
      const score=distance+(distance<14&&!aligned?14:0);
      return score<best.score?{distance,score,edgeIndex:index,...edge}:best;
    },{distance:Infinity,score:Infinity,height:CUTAWAY_HEIGHT,thickness:12});
    if(!wall.a)return {...opening,height:wall.height,thickness:wall.thickness};
    const a=wall.planA||wall.a,b=wall.planB||wall.b,px=b.x-a.x,py=b.y-a.y;
    const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y;
    const length=Math.hypot(px,py);
    const rawT=((opening.x-a.x)*px+(opening.y-a.y)*py)/(px*px+py*py);
    const edgeClearance=Math.min(21/Math.max(length,21),.5);
    const t=Math.max(edgeClearance,Math.min(1-edgeClearance,rawT));
    let angle=Math.atan2(dy,dx)*180/Math.PI;
    if(Math.cos((angle-(opening.angle||0))*Math.PI/180)<0)angle+=angle>0?-180:180;
    return {...opening,x:wall.a.x+t*dx,y:wall.a.y+t*dy,angle,height:wall.height,thickness:wall.thickness,wallPosition:t,wallIndex:wall.edgeIndex,wallLength:length,wallA:a,wallB:b,renderWallA:wall.a,renderWallB:wall.b};
  });
}

export function combineNearbyWindows(openings, gap = 18){
  const result=[];
  for(const opening of openings){
    if(opening.type!=='window'){ result.push(opening); continue; }
    const angle=(opening.angle||0)*Math.PI/180;
    const center=opening.wallLength===undefined?null:opening.wallPosition*opening.wallLength;
    const match=result.find(candidate=>candidate.type==='window' &&
      (opening.wallIndex===undefined||candidate.wallIndex===undefined||candidate.wallIndex===opening.wallIndex) &&
      Math.abs(Math.sin(((candidate.angle||0)-(opening.angle||0))*Math.PI/180))<.08 &&
      (center===null||Math.max(candidate.windowStart,center-21)-Math.min(candidate.windowEnd,center+21)<=gap) &&
      Math.abs((opening.x-candidate.x)*Math.sin(angle)-(opening.y-candidate.y)*Math.cos(angle))<10);
    const span=opening.windowSpan||42;
    const start=center===null?-span/2:center-span/2,end=center===null?span/2:center+span/2;
    if(!match){ result.push({...opening,windowSpan:span,windowStart:start,windowEnd:end,windowCount:opening.windowCount||1}); continue; }
    match.windowStart=Math.min(match.windowStart,start);match.windowEnd=Math.max(match.windowEnd,end);
    match.windowSpan=match.windowEnd-match.windowStart;
    match.windowCount=(match.windowCount||1)+(opening.windowCount||1);
    if(match.wallLength){
      const midpoint=(match.windowStart+match.windowEnd)/2;
      const t=Math.max(0,Math.min(1,midpoint/match.wallLength));
      const a=match.renderWallA||match.wallA,b=match.renderWallB||match.wallB;
      match.x=a.x+t*(b.x-a.x);match.y=a.y+t*(b.y-a.y);match.wallPosition=t;
    }
  }
  return result;
}

export function combineDoorPairs(openings, gap = 48){
  const result=[];
  for(const opening of openings){
    if(opening.type!=='door'){result.push(opening);continue;}
    // Mesh openings may already be paired. Never collapse their span/IDs on
    // a second pass (the decorated renderer used to do exactly that).
    if(opening.doorIds?.length===2){result.push({...opening,doorIds:[...opening.doorIds]});continue;}
    const match=result.find(candidate=>candidate.type==='door'&&
      (candidate.doorIds||[candidate.id]).length<2&&
      (opening.wallIndex===undefined||candidate.wallIndex===undefined||opening.wallIndex===candidate.wallIndex)&&
      Math.abs(Math.sin(((candidate.angle||0)-(opening.angle||0))*Math.PI/180))<.12&&
      Math.abs((candidate.x-opening.x)*Math.sin((opening.angle||0)*Math.PI/180)-(candidate.y-opening.y)*Math.cos((opening.angle||0)*Math.PI/180))<14&&
      Math.hypot(candidate.x-opening.x,candidate.y-opening.y)<84+gap);
    if(!match){result.push({...opening,doorSpan:42,doorIds:[opening.id]});continue;}
    const angle=(opening.angle||0)*Math.PI/180,cx=(match.x+opening.x)/2,cy=(match.y+opening.y)/2;
    result.splice(result.indexOf(match),1,{...match,x:cx,y:cy,doorSpan:84,doorIds:[...(match.doorIds||[match.id]),opening.id]});
  }
  return result;
}

// Larger floor-plan Y is closer to the camera. Compare depths at each projected
// point so diagonal walls also hide just the part of a door/window behind them.
export function openingOccluders(mesh,opening,{leaf=false,hingeAlong=-20,leafLength=40,swing=70}={}){
  const angle=(opening.angle||0)*Math.PI/180,side=Math.abs(Math.cos(angle))<.15;
  const leafAngle=angle+(leaf&&opening.open?swing*Math.PI/180:0);
  const x=opening.x+(leaf?hingeAlong*Math.cos(angle):0),y=opening.y+(leaf?hingeAlong*Math.sin(angle):0);
  let plane;
  if(opening.height<=18)plane=[0,1,0];
  else if(side&&opening.type==='window')plane=[0,1,opening.height];
  else if(side&&leaf&&!opening.open)plane=[0,0,Math.max(y,y+leafLength*Math.sin(leafAngle))];
  else if(side&&!(leaf&&opening.open))plane=[0,0,opening.y+Math.max(21,(opening.doorSpan||42)/2)];
  else if(leaf&&Math.abs(Math.cos(leafAngle))<.0001)plane=[0,0,Math.max(y,y+leafLength*Math.sin(leafAngle))];
  else plane=[Math.tan(leafAngle),0,y-Math.tan(leafAngle)*x];
  const pieces=[];
  for(const surface of mesh.surfaces){
    const front=frontHalfPlane(surface.bounds,surface.plane.map((n,i)=>n-plane[i]));
    if(!front)continue;
    const geometry=snapped(clipping.intersection(surface.geometry,front));
    if(geometry.length)pieces.push(geometry);
  }
  return pieces.length?snapped(clipping.union(...pieces)):[];
}
export function roomWallEdges(home){
  const outlines=floorOutlines(home),edges=[];
  [...outlines,...(home.holes||[])].forEach((ring,ri)=>{
    const plan=(area(ring)>=0)===(ri<outlines.length)?ring:[...ring].reverse();
    const points=alignedContour(plan),heights=contourHeights(points);
    const offsets=points.map((p,i)=>{
      let pi=(i+points.length-1)%points.length,ni=(i+1)%points.length;
      for(let k=0;k<points.length-1&&Math.hypot(points[pi].x-p.x,points[pi].y-p.y)<.001;k++)pi=(pi+points.length-1)%points.length;
      for(let k=0;k<points.length-1&&Math.hypot(points[ni].x-p.x,points[ni].y-p.y)<.001;k++)ni=(ni+1)%points.length;
      const before=points[pi],after=points[ni];
      const al=Math.hypot(p.x-before.x,p.y-before.y)||1,bl=Math.hypot(after.x-p.x,after.y-p.y)||1;
      const ax=(p.x-before.x)/al,ay=(p.y-before.y)/al,bx=(after.x-p.x)/bl,by=(after.y-p.y)/bl;
      const scale=6/Math.max(.01,1+ax*bx+ay*by),nx=(-ay-by)*scale,ny=(ax+bx)*scale,length=Math.hypot(nx,ny),limit=Math.min(1,24/(length||1));
      return {x:nx*limit,y:ny*limit};
    });
    points.forEach((a,i)=>{
      const next=(i+1)%points.length,b=points[next],na=offsets[i],nb=offsets[next];
      const footprint=[{x:a.x+na.x,y:a.y+na.y},{x:b.x+nb.x,y:b.y+nb.y},{x:b.x-nb.x,y:b.y-nb.y},{x:a.x-na.x,y:a.y-na.y}];
      edges.push({a,b,planA:plan[i],planB:plan[next],footprint,height:heights[i],exterior:true,thickness:12});
    });
  });
  const alignedPoint=p=>{
    for(const edge of edges){
      const a=edge.planA,b=edge.planB,dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
      if(!length||distanceToSegment(p,a,b)>.05)continue;
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length));
      return {x:edge.a.x+t*(edge.b.x-edge.a.x),y:edge.a.y+t*(edge.b.y-edge.a.y)};
    }
    return {...p};
  };
  const interior=[];
  for(const wall of home.walls)wall.points.slice(1).forEach((b,i)=>interior.push({a:alignedPoint(wall.points[i]),b:alignedPoint(b),planA:wall.points[i],planB:b,height:WALL_HEIGHT,exterior:false,thickness:Math.max(3,Number(wall.thickness)||7),wallId:wall.id}));
  // Short connector pieces inherit the actual straight line of their long
  // neighbor instead of making square-cap bumps at the join.
  for(const edge of interior){
    const length=Math.hypot(edge.b.x-edge.a.x,edge.b.y-edge.a.y);
    if(length>=12||length<.001)continue;
    const source=interior.find(other=>{
      const dx=other.b.x-other.a.x,dy=other.b.y-other.a.y,l=Math.hypot(dx,dy);
      return l>=48&&Math.abs((edge.b.x-edge.a.x)*dy-(edge.b.y-edge.a.y)*dx)/(length*l)<.005&&Math.min(Math.hypot(edge.a.x-other.a.x,edge.a.y-other.a.y),Math.hypot(edge.a.x-other.b.x,edge.a.y-other.b.y),Math.hypot(edge.b.x-other.a.x,edge.b.y-other.a.y),Math.hypot(edge.b.x-other.b.x,edge.b.y-other.b.y))<.25;
    });
    if(!source)continue;
    const dx=source.b.x-source.a.x,dy=source.b.y-source.a.y,l=dx*dx+dy*dy;
    for(const p of [edge.a,edge.b]){const t=((p.x-source.a.x)*dx+(p.y-source.a.y)*dy)/l;p.x=source.a.x+t*dx;p.y=source.a.y+t*dy;}
  }
  edges.push(...interior);
  const valid=edges.filter(({a,b})=>Math.hypot(b.x-a.x,b.y-a.y)>.01);
  // A straight outside wall can become a shared room divider and then emerge
  // outside again. Its visible cap must not narrow halfway along that run.
  const continuous=valid.filter(e=>e.exterior&&Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)>=24);
  const reached=new Set(continuous);
  for(let i=0;i<continuous.length;i++){
    const source=continuous[i],sx=source.b.x-source.a.x,sy=source.b.y-source.a.y,sl=Math.hypot(sx,sy);
    for(const edge of valid){
      if(reached.has(edge)||edge.exterior)continue;
      const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,length=Math.hypot(dx,dy);
      if(Math.abs(sx*dy-sy*dx)/(sl*length)>.005)continue;
      if(Math.min(distanceToSegment(edge.a,source.a,source.b),distanceToSegment(edge.b,source.a,source.b),distanceToSegment(source.a,edge.a,edge.b),distanceToSegment(source.b,edge.a,edge.b))>.25)continue;
      edge.thickness=source.thickness;reached.add(edge);continuous.push(edge);
    }
  }
  return valid;
}

// A plan stroke can visibly meet a junction even when its endpoint is a few
// pixels off its neighbour's centreline. Use that same junction in Decorate,
// favouring an axis-aligned run so a horizontal divider remains horizontal.
function decorateWallEdges(planEdges){
  const aligned=planEdges.map(edge=>{
    if(edge.exterior)return edge;
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y;
    if(Math.min(Math.abs(dx),Math.abs(dy))<.005*Math.hypot(dx,dy))return edge;
    const endpoint=p=>{
      let best=p,distance=Infinity;
      for(const other of planEdges){
        if(other===edge||other.exterior)continue;
        const ox=other.b.x-other.a.x,oy=other.b.y-other.a.y;
        if(Math.min(Math.abs(ox),Math.abs(oy))>.005*Math.hypot(ox,oy))continue;
        for(const q of [other.a,other.b]){
          const d=Math.hypot(q.x-p.x,q.y-p.y);
          if(d>=distance||d>Math.min(edge.thickness,other.thickness)/2)continue;
          const host=planEdges.some(e=>e!==edge&&e!==other&&distanceToSegment(p,e.a,e.b)<.05&&distanceToSegment(q,e.a,e.b)<.05);
          if(host){best=q;distance=d;}
        }
      }
      return {...best};
    };
    return {...edge,a:endpoint(edge.a),b:endpoint(edge.b)};
  });
  return aligned.map(edge=>{
    if(edge.exterior)return edge;
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y;
    if(Math.min(Math.abs(dx),Math.abs(dy))<.005*Math.hypot(dx,dy))return edge;
    const anchor=p=>{
      const front=aligned.find(e=>e.height===CUTAWAY_HEIGHT&&distanceToSegment(p,e.a,e.b)<.05);
      if(!front)return {point:p,anchored:false};
      const upright=aligned.some(e=>e!==edge&&e.height===WALL_HEIGHT&&Math.abs(e.b.x-e.a.x)<=Math.abs(e.b.y-e.a.y)*.005&&distanceToSegment(p,e.a,e.b)<.05);
      // A free divider ending along the front already uses a flush cutaway
      // continuation. This rule is for the actual corner shared with a side
      // wall, where continuing sideways would put it in the neighboring room.
      if(!upright)return {point:p,anchored:false};
      // The thin top edge must meet the INSIDE of the low front border, not
      // a floating point one wall-height above it. Move the whole displayed
      // run (including its base), then extrude uniformly; do not taper height.
      return {point:{x:p.x,y:p.y+WALL_HEIGHT-front.thickness/2},anchored:true};
    };
    const a=anchor(edge.a),b=anchor(edge.b);
    return a.anchored||b.anchored?{...edge,a:a.point,b:b.point,cutawayAnchored:true}:edge;
  });
}

// Intersect neighboring offset lines at joined endpoints. Square end caps
// overlap past a diagonal's side and leave little stair-step notches at T/Y
// junctions. These miters change only the wall thickness, never its centerline.
function joinedWallStrips(edges){
  const result=new Map(),junctions=[];
  for(const edge of edges){
    if(edge.exterior)continue;
    const endPoint=(p,q,side)=>{
      const length=Math.hypot(q.x-p.x,q.y-p.y),ux=(q.x-p.x)/length,uy=(q.y-p.y)/length,half=edge.thickness/2;
      const offset={x:p.x-uy*half*side,y:p.y+ux*half*side};
      const neighbors=edges.flatMap(other=>{
        if(other===edge||other.height!==edge.height||distanceToSegment(p,other.a,other.b)>.05)return [];
        return [other.a,other.b].flatMap(at=>{
          const l=Math.hypot(at.x-p.x,at.y-p.y);
          if(l<.05)return [];
          const vx=(at.x-p.x)/l,vy=(at.y-p.y)/l;
          let angle=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);
          if(angle<0)angle+=2*Math.PI;
          return angle<.0001||angle>2*Math.PI-.0001?[]:[{vx,vy,angle,half:other.thickness/2}];
        });
      }).sort((a,b)=>a.angle-b.angle);
      if(!neighbors.length)return {x:offset.x-ux*half,y:offset.y-uy*half};
      const other=side>0?neighbors[0]:neighbors[neighbors.length-1],cross=ux*other.vy-uy*other.vx;
      if(Math.abs(cross)<.0001)return offset;
      const ox=p.x+other.vy*other.half*side,oy=p.y-other.vx*other.half*side;
      const t=((ox-offset.x)*other.vy-(oy-offset.y)*other.vx)/cross;
      const miter={x:offset.x+t*ux,y:offset.y+t*uy};
      // Acute corners use a bounded bevel rather than a long projecting spike.
      return Math.hypot(miter.x-p.x,miter.y-p.y)<=4*Math.max(half,other.half)?miter:offset;
    };
    const aPlus=endPoint(edge.a,edge.b,1),bPlus=endPoint(edge.b,edge.a,-1),bMinus=endPoint(edge.b,edge.a,1),aMinus=endPoint(edge.a,edge.b,-1);
    result.set(edge,polygon([aPlus,bPlus,bMinus,aMinus]));
    // Offset-line intersections trim the runs back from a T/Y junction.
    // Fill the space between each trimmed end and the shared node as well;
    // otherwise three correctly mitered strips surround a triangular HOLE,
    // which the cap outline draws as an arrow/notch in the connected wall.
    for(const [p,left,right] of [[edge.a,aPlus,aMinus],[edge.b,bPlus,bMinus]]){
      if(Math.abs((left.x-p.x)*(right.y-p.y)-(left.y-p.y)*(right.x-p.x))>EPS)junctions.push(polygon([p,left,right]));
    }
  }
  return {strips:result,junctions};
}

// Continue a free divider's drawing into its cutaway join, not its saved plan
// segment. The continuation is later trimmed against the room's silhouette.
// A junction with a raised wall already has a return: never slide that corner
// along the diagonal, which would push it into the neighboring room.
function cutawayStrips(edges,joined){
  const result=new Map();
  for(const edge of edges){
    if(edge.exterior||edge.cutawayAnchored)continue;
    for(const [end,other] of [[edge.a,edge.b],[edge.b,edge.a]]){
      if(edges.some(e=>e!==edge&&e.height===WALL_HEIGHT&&distanceToSegment(end,e.a,e.b)<.05))continue;
      const front=edges.find(e=>e.height===CUTAWAY_HEIGHT&&distanceToSegment(end,e.a,e.b)<.05);
      if(!front)continue;
      const length=Math.hypot(end.x-other.x,end.y-other.y),ux=(end.x-other.x)/length,uy=(end.y-other.y)/length;
      const nx=front.b.y-front.a.y,ny=front.a.x-front.b.x,outward=ux*nx+uy*ny;
      if(outward<=EPS||ny<=EPS)continue;
      // Moving up by WALL_HEIGHT moves the cap away from the front cut plane.
      // Continue along the SAME straight run far enough to meet that plane.
      const reach=WALL_HEIGHT*ny/outward+edge.thickness*2;
      const continued=(result.get(edge)||joined.get(edge)||strip(edge)).map(ring=>ring.map(p=>[...p]));
      for(const i of end===edge.a?[0,3]:[1,2]){
        continued[0][i][0]+=ux*reach;continued[0][i][1]+=uy*reach;
      }
      result.set(edge,continued);
    }
  }
  return result;
}

// Uniform extrusion keeps both long edges parallel at every angle. All
// footprints at a height are united BEFORE projection, so joins have no seams.
function wallSurfaces(edges,stripsByEdge=new Map(),junctions=[]){
  const surfaces=[];
  const joinedDiagonal=(edge,point)=>edges.some(other=>{
    if(other===edge||other.height!==WALL_HEIGHT||distanceToSegment(point,other.a,other.b)>.05)return false;
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,ox=other.b.x-other.a.x,oy=other.b.y-other.a.y;
    const diagonal=Math.abs(dx*dy)>EPS||Math.abs(ox*oy)>EPS;
    return diagonal&&Math.abs(dx*oy-dy*ox)/(Math.hypot(dx,dy)*Math.hypot(ox,oy))>.005;
  });
  for(const height of [WALL_HEIGHT,CUTAWAY_HEIGHT]){
    const strips=edges.filter(e=>e.height===height).map(e=>stripsByEdge.get(e)||strip(e));
    if(height===WALL_HEIGHT)strips.push(...junctions);
    if(!strips.length)continue;
    const footprint=clipping.union(...strips);
    const caps=snapped(footprint.map(poly=>poly.map(ring=>ring.map(([x,y])=>[x,y-height]))));
    surfaces.push({kind:'cap',height,plane:[0,1,height],original:caps});
    if(height===CUTAWAY_HEIGHT)continue;
    for(const poly of footprint)for(const ring of poly)for(let i=1;i<ring.length;i++){
      const [ax,ay]=ring[i-1],[bx,by]=ring[i],dx=bx-ax;
      // The camera sees the south-facing surface. Vertical sides get their
      // visible thickness from the footprint and its finite end faces.
      if(dx>=-EPS)continue;
      const slope=(by-ay)/dx;
      // The low front and edge-on wall ends form one visible perimeter strip.
      // Keeping cap outlines across those ends makes a joined wall look cut.
      const rimReturn=edges.some(edge=>{
        if(edge.height!==height)return false;
        if(edge.footprint){
          const p=edge.footprint;
          return [[p[0],p[3],edge.a],[p[1],p[2],edge.b]].some(([a,b,end])=>distanceToSegment({x:ax,y:ay},a,b)<.001&&distanceToSegment({x:bx,y:by},a,b)<.001&&!joinedDiagonal(edge,end));
        }
        const length=Math.hypot(edge.b.x-edge.a.x,edge.b.y-edge.a.y),ux=(edge.b.x-edge.a.x)/length,uy=(edge.b.y-edge.a.y)/length;
        const mx=(ax+bx)/2,my=(ay+by)/2,half=edge.thickness/2,fx=bx-ax,fy=by-ay;
        const along=(mx-edge.a.x)*ux+(my-edge.a.y)*uy,across=(mx-edge.a.x)*uy-(my-edge.a.y)*ux;
        // A strip's exposed end is perpendicular to its wall, at any angle.
        const isEnd=Math.abs(fx*ux+fy*uy)<.001&&Math.hypot(fx,fy)<=edge.thickness+.001&&Math.abs(across)<=half+.001&&(Math.abs(along+half)<.001||Math.abs(along-length-half)<.001);
        // At a diagonal/raised-wall junction this exposed return belongs to
        // the shared wall FACE, not the outlined cap. Outlining it puts an
        // upright seam on top of the adjoining diagonal even after unioning.
        return isEnd&&!joinedDiagonal(edge,along<0?edge.a:edge.b);
      });
      surfaces.push({kind:'face',rimReturn,height,plane:[slope,0,ay-slope*ax],original:snapped([[[[ax,ay],[bx,by],[bx,by-height],[ax,ay-height],[ax,ay]]]])});
    }
  }
  return surfaces;
}

// A vertical divider meeting a diagonal at the cutaway front still needs its
// visible narrow strip all the way to the bottom border. The diagonal's face
// must not swallow that strip when the shared wall material is merged.
function uprightFrontReturns(edges,surfaces){
  const solid=surfaces.length?clipping.union(...surfaces.map(s=>s.original)):[];
  const returns=[];
  for(const edge of edges){
    if(edge.exterior)continue;
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y;
    if(Math.abs(dx)>Math.abs(dy)*.005)continue;
    const end=dy>0?edge.b:edge.a;
    if(!edges.some(e=>e.height===CUTAWAY_HEIGHT&&distanceToSegment(end,e.a,e.b)<.05))continue;
    if(!edges.some(e=>e!==edge&&e.height===WALL_HEIGHT&&distanceToSegment(end,e.planA||e.a,e.planB||e.b)<.05))continue;
    const half=edge.thickness/2,top=end.y-WALL_HEIGHT-4*half;
    const band=polygon([{x:end.x-half,y:top},{x:end.x+half,y:top},{x:end.x+half,y:end.y},{x:end.x-half,y:end.y}]);
    // Restore cap styling only inside the existing solid. This cannot move a
    // plan endpoint, widen the room, or put a connector through an empty room.
    const original=snapped(clipping.intersection(band,solid));
    if(original.length)returns.push({kind:'face',rimReturn:true,uprightReturn:true,height:WALL_HEIGHT,plane:[0,0,end.y],original});
  }
  return returns;
}

export function buildRoomWalls(home){
  const planEdges=roomWallEdges(home),edges=decorateWallEdges(planEdges),{strips:joined,junctions}=joinedWallStrips(edges),joins=cutawayStrips(edges,joined),physical=wallSurfaces(edges,joined,junctions);
  const anchored=edges.some(e=>e.cutawayAnchored);
  let surfaces=physical;
  if(joins.size||anchored){
    let floor=floorOutlines(home).map(r=>polygon(r));
    if(home.holes?.length)floor=clipping.difference(floor,...home.holes.map(polygon));
    // Keep the original raised back/side outline, plus the actual floor. Only
    // the new cutaway continuations are affected by this screen-space trim.
    // This also handles stepped/concave fronts without extending into space.
    const source=anchored?joinedWallStrips(planEdges):null;
    const sourceSurfaces=source?wallSurfaces(planEdges,source.strips,source.junctions):physical;
    const envelope=clipping.union(floor,...sourceSurfaces.map(s=>s.original));
    surfaces=wallSurfaces(edges,new Map([...joined,...joins]),junctions).flatMap(surface=>{
      const original=snapped(clipping.intersection(surface.original,envelope));
      return original.length?[{...surface,original}]:[];
    });
  }
  surfaces.push(...uprightFrontReturns(edges,surfaces));
  const fronts=edges.filter(e=>e.height===CUTAWAY_HEIGHT).map(strip);
  if(fronts.length){
    const border=clipping.union(...fronts);
    // The low front border owns its entire band. Trim raised walls to its
    // INSIDE edge, not the outside silhouette: otherwise a diagonal cap cuts
    // through the border and leaves two slanted lines on its bottom edge.
    surfaces=surfaces.flatMap(surface=>{
      if(surface.height===CUTAWAY_HEIGHT)return [surface];
      const original=snapped(clipping.difference(surface.original,border));
      return original.length?[{...surface,original}]:[];
    });
  }
  const openings=combineDoorPairs(combineNearbyWindows(roomOpenings(home,edges),24));
  for(const surface of surfaces){
    surface.bounds=bounds(surface.original);
    for(const opening of openings){
      const cutout=openingCutout(surface,opening);
      if(cutout.length)surface.original=snapped(clipping.difference(surface.original,cutout));
    }
  }
  for(const surface of surfaces){
    let visible=surface.original;
    // Plain faces share a material without internal strokes. Outlined rim
    // pieces need depth clipping before they become one continuous border.
    // Upright front returns are the cutaway outline of the vertical divider,
    // not another recessed face. Keep them visible over the adjoining diagonal.
    if(surface.uprightReturn||surface.kind==='face'&&!surface.rimReturn){surface.geometry=visible;continue;}
    for(const other of surfaces){
      if(other===surface||surface.kind==='cap'&&other.height<=surface.height||!visible.length||!overlaps(surface.bounds,other.bounds))continue;
      // Rim pieces merge into a single outline. Clipping them against each
      // other first leaves hairline cuts across otherwise continuous corners.
      if(other.kind==='cap'||other.rimReturn)continue;
      const delta=other.plane.map((n,i)=>n-surface.plane[i]);
      const front=frontHalfPlane(surface.bounds,delta);
      if(!front)continue;
      const occluder=snapped(clipping.intersection(other.original,front));
      if(occluder.length)visible=snapped(clipping.difference(visible,occluder));
    }
    surface.geometry=visible;
  }
  const silhouette=surfaces.length?clipping.union(...surfaces.map(s=>s.original)):[];
  const visible=surfaces.filter(s=>s.geometry.length),rimSurfaces=visible.filter(s=>s.kind==='cap'||s.rimReturn);
  const rim=rimSurfaces.length?snapped(clipping.union(...rimSurfaces.map(s=>s.geometry))):[];
  const faceSurfaces=visible.filter(s=>s.kind==='face'&&!s.rimReturn);
  const faces=faceSurfaces.length?snapped(clipping.union(...faceSurfaces.map(s=>s.geometry))):[];
  return {edges:planEdges,projectedEdges:edges,openings,surfaces:visible,silhouette,rim,faces};
}
export function wallGeometryPath(geometry){
  return geometry.flatMap(poly=>poly.map(ring=>'M'+ring.map(([x,y])=>`${x},${y}`).join(' L')+' Z')).join(' ');
}
