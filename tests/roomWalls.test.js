import test from 'node:test';
import assert from 'node:assert/strict';
import {initialHome,normalizePlan,pointInPolygon,rectangleFromPoints,distanceToSegment} from '../src/model.js';
import {buildRoomWalls,openingOccluders,wallGeometryPath} from '../src/roomWalls.js';

const rectangle=(a,b)=>rectangleFromPoints(a,b);
const contains=(geometry,p)=>geometry.some(poly=>pointInPolygon(p,poly[0].map(([x,y])=>({x,y})))&&!poly.slice(1).some(r=>pointInPolygon(p,r.map(([x,y])=>({x,y})))));
const homeWith=walls=>normalizePlan({...initialHome(),boundary:rectangle({x:100,y:100},{x:700,y:500}),walls});

test('a divider T joint becomes a single cap without a line through the junction',()=>{
  const mesh=buildRoomWalls(homeWith([{id:'divider',points:[{x:400,y:100},{x:400,y:500}]}]));
  const cap=mesh.surfaces.find(s=>s.kind==='cap'&&s.height===70),joint={x:400,y:30};
  assert.ok(contains(cap.geometry,joint));
  const edgeDistances=cap.geometry.flatMap(poly=>poly.flatMap(r=>r.slice(1).map(([x,y],i)=>distanceToSegment(joint,{x:r[i][0],y:r[i][1]},{x,y}))));
  assert.ok(Math.min(...edgeDistances)>3,'the joint must be inside the cap rather than on an internal border');
});
test('stepped room connections keep a flat continuous border at the open front',()=>{
  const home=normalizePlan({...initialHome(),sections:[{id:'left',points:rectangle({x:100,y:100},{x:450,y:500})},{id:'right',points:rectangle({x:450,y:50},{x:700,y:400})}],walls:[{id:'divider',points:[{x:100,y:430},{x:450,y:430}]}]});
  const mesh=buildRoomWalls(home);
  assert.ok(contains(mesh.rim,{x:470,y:400}),'the lower room edge stays on the floor');
  assert.equal(contains(mesh.silhouette,{x:470,y:360}),false,'the front does not acquire a raised wall panel');
  assert.ok(contains(mesh.rim,{x:450,y:480}),'the side border continues to the lower room corner on the floor');
});
test('vertical walls have finite width and faces without separate connector strokes',()=>{
  const mesh=buildRoomWalls(homeWith([]));
  assert.ok(contains(mesh.silhouette,{x:100,y:200}));
  assert.ok(contains(mesh.silhouette,{x:104,y:200}));
  assert.equal(contains(mesh.silhouette,{x:120,y:200}),false);
  assert.doesNotMatch(wallGeometryPath(mesh.silhouette),/NaN|Infinity/);
});

test('side borders continue into the open front without cap-end seams or a raised panel',()=>{
  const mesh=buildRoomWalls(homeWith([]));
  const edgeDistance=p=>Math.min(...mesh.rim.flatMap(poly=>poly.flatMap(ring=>ring.slice(1).map(([x,y],i)=>distanceToSegment(p,{x:ring[i][0],y:ring[i][1]},{x,y})))));
  for(const x of [100,700]){
    assert.ok(contains(mesh.rim,{x,y:470}),'the side border continues to the floor front');
    assert.ok(edgeDistance({x,y:430})>5,'no former cap end crosses the side border');
    assert.ok(edgeDistance({x,y:500})>5,'the lower corner belongs to one joined outline');
  }
  assert.ok(contains(mesh.rim,{x:400,y:500}),'the front border stays at floor level');
  assert.equal(contains(mesh.silhouette,{x:400,y:470}),false,'the front remains open instead of receiving a wall face');
});

test('polygon side bends keep raised walls with continuous mitered caps and no transverse cuts',()=>{
  const boundary=[{x:100,y:250},{x:160,y:80},{x:260,y:120},{x:290,y:180},{x:230,y:360},{x:120,y:370}];
  const mesh=buildRoomWalls(normalizePlan({...initialHome(),boundary}));
  assert.deepEqual(mesh.edges.filter(e=>e.exterior).map(e=>e.height),[70,70,70,70,0,70]);
  const joint={x:100,y:180};
  const segments=mesh.rim.flatMap(poly=>poly.flatMap(r=>r.slice(1).map(([x,y],i)=>({a:{x:r[i][0],y:r[i][1]},b:{x,y}}))));
  assert.ok(Math.min(...segments.map(({a,b})=>distanceToSegment(joint,a,b)))>5,'the side bend is inside one cap, without a cross-line');
});

test('vertical, angled and curved interior dividers retain their raised walls',()=>{
  const home=homeWith([{id:'vertical',points:[{x:400,y:100},{x:400,y:500}]},{id:'steep',points:[{x:500,y:150},{x:550,y:450}]},{id:'curve',curved:true,points:[{x:150,y:200},{x:200,y:260},{x:180,y:350}]}]);
  const mesh=buildRoomWalls(home),dividers=mesh.edges.filter(e=>!e.exterior);
  assert.ok(dividers.length>=4);
  assert.ok(dividers.every(e=>e.height===70),'divider height never depends on its direction');
  assert.ok(mesh.surfaces.some(s=>s.kind==='cap'&&s.height===70&&contains(s.geometry,{x:400,y:250})));
});

test('a straight wall keeps its exterior width through a shared room section',()=>{
  const home=normalizePlan({...initialHome(),sections:[{id:'left',points:rectangle({x:100,y:100},{x:450,y:500})},{id:'right',points:rectangle({x:450,y:200},{x:700,y:400})}],walls:[{id:'unrelated',points:[{x:300,y:150},{x:300,y:350}]}]});
  const mesh=buildRoomWalls(home),shared=mesh.edges.filter(e=>!e.exterior&&Math.abs(e.a.x-450)<.01&&Math.abs(e.b.x-450)<.01);
  assert.ok(shared.length>0);
  assert.ok(shared.every(e=>e.thickness===12),'the shared portion matches the outside portions of the same wall');
  assert.ok(mesh.edges.filter(e=>!e.exterior&&e.a.x===300&&e.b.x===300).every(e=>e.thickness===7),'separate room dividers retain their slimmer width');
});

test('tiny parallel room joins extrude as one straight wall without a raised bump',()=>{
  const boundary=[{x:100,y:100},{x:400,y:100},{x:400,y:97},{x:700,y:97},{x:700,y:500},{x:100,y:500}];
  const home=normalizePlan({...initialHome(),boundary}),before=JSON.stringify(home),mesh=buildRoomWalls(home);
  const top=mesh.edges.filter(e=>e.exterior&&e.planA.y<=100&&e.planB.y<=100&&e.b.x-e.a.x>24);
  assert.equal(top.length,2);
  assert.ok(top.every(e=>Math.abs(e.a.y-100)<.001&&Math.abs(e.b.y-100)<.001));
  const cap=mesh.surfaces.find(s=>s.kind==='cap'&&s.height===70);
  assert.ok(contains(cap.geometry,{x:400,y:30}));
  assert.equal(JSON.stringify(home),before,'render alignment never changes the saved floor plan');
  const opening=buildRoomWalls({...home,openings:[{id:'side',type:'door',x:700,y:298.5,angle:90}]}).openings[0];
  assert.equal(opening.wallPosition,.5);
  assert.equal(opening.y,300,'a door halfway along the plan wall stays halfway along its aligned wall');
  const stepped=buildRoomWalls(normalizePlan({...initialHome(),boundary:boundary.map(p=>p.y===97?{...p,y:60}:p)}));
  assert.ok(stepped.edges.some(e=>e.a.y===60&&e.b.y===60),'an intentional room step remains intact');
});

test('an opening near a junction stays on the wall matching its floor-plan direction',()=>{
  const home=homeWith([{id:'across',points:[{x:100,y:300},{x:700,y:300}]}]);
  home.openings=[{id:'door',type:'door',x:696,y:300,angle:90}];
  const opening=buildRoomWalls(home).openings[0];
  assert.equal(opening.x,700);assert.equal(opening.y,300);assert.equal(opening.angle,90);
});

test('a tiny freehand wobble on the open front does not become an isolated wall post',()=>{
  const boundary=[{x:100,y:100},{x:700,y:100},{x:700,y:500},{x:500,y:500},{x:492,y:486},{x:490,y:500},{x:100,y:500}];
  const home=normalizePlan({...initialHome(),boundary}),mesh=buildRoomWalls(home);
  const wobble=mesh.edges.filter(e=>e.exterior&&e.planA.x<=500&&e.planA.x>=490&&e.planB.x<=500&&e.planB.x>=490);
  assert.equal(wobble.length,2);assert.ok(wobble.every(e=>e.height===0));
  assert.equal(contains(mesh.silhouette,{x:492,y:435}),false,'no post rises above the freehand contour');
  assert.ok(mesh.edges.filter(e=>e.exterior&&e.a.x===700&&e.b.x===700).every(e=>e.height===70),'the actual side wall stays raised');
});

test('angled and curved front borders remain on the floor and keep their contours',()=>{
  for(const boundary of [
    [{x:100,y:250},{x:160,y:80},{x:260,y:120},{x:290,y:180},{x:230,y:360},{x:120,y:370}],
    Array.from({length:48},(_,i)=>({x:400+240*Math.cos(i/48*Math.PI*2),y:350+180*Math.sin(i/48*Math.PI*2)}))
  ]){
    const home=normalizePlan({...initialHome(),boundary}),mesh=buildRoomWalls(home);
    for(const edge of mesh.edges.filter(e=>e.exterior&&e.height===0)){
      assert.ok(contains(mesh.rim,{x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2}),'every open perimeter segment stays joined at floor level');
    }
  }
});

test('rear doors and windows cut their own wall while preserving and hiding behind a foreground wall',()=>{
  for(const type of ['door','window']){
    const home=homeWith([{id:'rear',points:[{x:100,y:300},{x:700,y:300}]},{id:'front',points:[{x:100,y:340},{x:700,y:340}]}]);
    home.openings=[{id:'opening',type,x:400,y:300,angle:0}];
    const mesh=buildRoomWalls(home),occluders=openingOccluders(mesh,mesh.openings[0]);
    assert.equal(mesh.surfaces.some(s=>contains(s.geometry,{x:400,y:250})),false,'the opening cuts its supporting wall');
    assert.ok(mesh.surfaces.some(s=>contains(s.geometry,{x:400,y:285})),'the foreground wall has no hole from the rear opening');
    assert.ok(contains(occluders,{x:400,y:285}),'the foreground wall hides the rear artwork');
    assert.equal(contains(occluders,{x:400,y:250}),false,'the visible upper part remains visible');
  }
});

test('side doors hide behind lower walls and never cut those walls',()=>{
  const home=homeWith([{id:'front',points:[{x:100,y:350},{x:700,y:350}]}]);
  home.openings=[{id:'side',type:'door',x:700,y:320,angle:90}];
  const mesh=buildRoomWalls(home),p={x:695,y:320};
  assert.ok(mesh.surfaces.some(s=>contains(s.geometry,p)));
  assert.ok(contains(openingOccluders(mesh,mesh.openings[0]),p));
});

test('an open door leaf uses its swung position when it passes in front of its own wall',()=>{
  const home=homeWith([{id:'rear',points:[{x:100,y:300},{x:700,y:300}]}]);
  home.openings=[{id:'door',type:'door',x:400,y:300,angle:0,open:true}];
  const mesh=buildRoomWalls(home),opening=mesh.openings[0],leaf=openingOccluders(mesh,opening,{leaf:true});
  assert.equal(contains(leaf,{x:391,y:295}),false,'the leaf in front of the jamb stays visible');
});

test('openings stay anchored to the supporting wall position and angle',()=>{
  const home=homeWith([{id:'slanted',points:[{x:200,y:200},{x:600,y:400}]}]);
  home.openings=[{id:'door',type:'door',x:401,y:298,angle:0}];
  const opening=buildRoomWalls(home).openings[0];
  assert.ok(Math.abs(opening.angle-Math.atan2(200,400)*180/Math.PI)<.0001);
  assert.ok(distanceToSegment(opening,{x:200,y:200},{x:600,y:400})<.0001);
});

test('door visibility remains finite when a diagonal door swings exactly edge-on',()=>{
  for(const angle of [20,-160,90,-90]){
    const radians=angle*Math.PI/180,dx=180*Math.cos(radians),dy=180*Math.sin(radians);
    const home=homeWith([{id:'slanted',points:[{x:400-dx,y:300-dy},{x:400+dx,y:300+dy}]}]);
    home.openings=[{id:'door',type:'door',x:400,y:300,angle,open:true}];
    const mesh=buildRoomWalls(home);
    assert.doesNotMatch(wallGeometryPath(openingOccluders(mesh,mesh.openings[0],{leaf:true})),/NaN|Infinity/);
  }
});
test('round and diagonal wall meshes remain valid after visibility clipping',()=>{
  for(const boundary of [Array.from({length:48},(_,i)=>({x:400+240*Math.cos(i/48*Math.PI*2),y:350+180*Math.sin(i/48*Math.PI*2)})),[{x:100,y:100},{x:700,y:180},{x:600,y:550},{x:150,y:470}]]){
    const mesh=buildRoomWalls(normalizePlan({...initialHome(),boundary}));
    assert.ok(mesh.surfaces.length>0);assert.doesNotMatch(wallGeometryPath(mesh.silhouette),/NaN|Infinity/);
    assert.ok(mesh.surfaces.every(s=>s.geometry.length));
  }
});
test('irregular freehand walls and crossing dividers produce finite joined surfaces',()=>{
  for(let variant=0;variant<12;variant++){
    const boundary=Array.from({length:32},(_,i)=>{const t=i/32*Math.PI*2,r=1+.12*Math.sin(t*3+variant*.7);return {x:450+250*r*Math.cos(t),y:350+200*r*Math.sin(t)};});
    const home=normalizePlan({...initialHome(),boundary,walls:[{id:'across',points:[{x:100,y:300+variant*5},{x:800,y:380-variant*2}]},{id:'down',points:[{x:350+variant*4,y:50},{x:500,y:650}]}]});
    const mesh=buildRoomWalls(home);
    assert.ok(mesh.surfaces.length);assert.doesNotMatch(wallGeometryPath(mesh.silhouette),/NaN|Infinity/);
  }
});
