import test from 'node:test';
import assert from 'node:assert/strict';
import {initialHome,normalizePlan,pointInPolygon,rectangleFromPoints,distanceToSegment} from '../src/model.js';
import {buildRoomWalls,combineDoorPairs,openingOccluders,wallGeometryPath} from '../src/roomWalls.js';

const rectangle=(a,b)=>rectangleFromPoints(a,b);
const contains=(geometry,p)=>geometry.some(poly=>pointInPolygon(p,poly[0].map(([x,y])=>({x,y})))&&!poly.slice(1).some(r=>pointInPolygon(p,r.map(([x,y])=>({x,y})))));
const homeWith=walls=>normalizePlan({...initialHome(),boundary:rectangle({x:100,y:100},{x:700,y:500}),walls});

test('an already paired doorway keeps its full cutout and both IDs on subsequent rendering passes',()=>{
  const home=homeWith([]);
  home.openings=[{id:'left',type:'door',x:379,y:100,angle:0},{id:'right',type:'door',x:421,y:100,angle:0}];
  const mesh=buildRoomWalls(home),[door]=mesh.openings;
  assert.equal(mesh.openings.length,1);
  assert.equal(door.doorSpan,84);
  assert.deepEqual(door.doorIds,['left','right']);
  assert.deepEqual(combineDoorPairs(mesh.openings),mesh.openings);
  for(const x of [370,430])assert.equal(mesh.surfaces.some(s=>contains(s.geometry,{x,y:70})),false,'both halves of the supporting wall are cut out');
});

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

test('diagonal dividers keep constant height and parallel faces at cutaway junctions',()=>{
  for(const [startX,x] of [[160,240],[160,460],[640,340],[640,560]]){
    const home=homeWith([{id:'diagonal',points:[{x:startX,y:100},{x,y:500}]}]);
    const before=JSON.stringify(home),mesh=buildRoomWalls(home);
    const runs=mesh.edges.filter(e=>e.wallId==='diagonal');
    assert.equal(runs.length,1,'a straight divider stays a single straight run');
    assert.deepEqual(runs[0].a,{x:startX,y:100});assert.deepEqual(runs[0].b,{x,y:500});
    assert.equal(runs[0].height,70,'the cutaway must not lower a divider endpoint');
    for(const cap of mesh.surfaces.filter(s=>s.kind==='cap')){
      assert.deepEqual(cap.plane,[0,1,cap.height],'caps use only a uniform vertical translation');
      for(const [px,py] of cap.original.flat(2)){
        const ground={x:px,y:py+cap.height};
        assert.ok(mesh.projectedEdges.some(e=>{
          if(e.exterior)return distanceToSegment(ground,e.a,e.b)<24.1;
          const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y;
          return Math.abs((ground.x-e.a.x)*dy-(ground.y-e.a.y)*dx)/Math.hypot(dx,dy)<24.1;
        }),'cutaway caps continue along the original straight run, never bend sideways');
      }
    }
    for(const face of mesh.surfaces.filter(s=>s.kind==='face')){
      assert.equal(face.height,70);
      for(const [px,py] of face.original.flat(2)){
        const elevation=face.plane[0]*px+face.plane[1]*py+face.plane[2]-py;
        assert.ok(elevation>=-.001&&elevation<=70.001,'trimming a constant-height face never changes its extrusion');
      }
    }
    const joint={x,y:500};
    assert.ok(contains(mesh.rim,joint),'the divider connects to the continuous low rim');
    const distances=mesh.rim.flatMap(poly=>poly.flatMap(ring=>ring.slice(1).map(([bx,by],i)=>distanceToSegment(joint,{x:ring[i][0],y:ring[i][1]},{x:bx,y:by}))));
    assert.ok(Math.min(...distances)>5,'no diagonal end-cap seam crosses the joined front wall');
    assert.equal(JSON.stringify(home),before,'joining render solids does not move the saved divider');
  }
});

test('a diagonal cutaway meets the front border without a vertical end post',()=>{
  for(const [startX,endX] of [[160,460],[640,340]]){
    const home=homeWith([{id:'diagonal',points:[{x:startX,y:100},{x:endX,y:500}]}]);
    const before=JSON.stringify(home),mesh=buildRoomWalls(home);
    const middle={x:endX,y:465},continuation={x:endX+(endX-startX)*35/400,y:465};
    assert.ok(contains(mesh.silhouette,middle),'the former end is part of the continuous wall face');
    assert.equal(contains(mesh.rim,middle),false,'no upright cap return remains at the former end');
    assert.ok(mesh.surfaces.some(s=>s.kind==='cap'&&s.height===70&&contains(s.geometry,continuation)),'the parallel cap reaches the front instead of tapering');
    assert.ok(mesh.surfaces.filter(s=>s.height>0).every(s=>s.original.flat(2).every(([,y])=>y<=494.001)),'raised walls stop at the inside edge instead of slicing through the front border');
    assert.equal(JSON.stringify(home),before,'the visual join never relocates the floor-plan endpoint');
  }
});

test('a freestanding diagonal divider keeps its end instead of reaching the cutaway border',()=>{
  const mesh=buildRoomWalls(homeWith([{id:'free',points:[{x:160,y:100},{x:460,y:470}]}]));
  assert.ok(!mesh.surfaces.filter(s=>s.kind==='cap'&&s.height===70).some(s=>s.original.flat(2).some(([x,y])=>Math.abs(y-494)<.001&&Math.abs(x-480)<40)));
});

test('a shallow diagonal at a shared front junction does not pull the vertical cap into another room',()=>{
  const home=homeWith([
    {id:'vertical',points:[{x:460,y:100},{x:460,y:500}]},
    {id:'horizontal',points:[{x:460,y:370},{x:700,y:370}]},
    {id:'diagonal',points:[{x:460,y:500},{x:700,y:370}]},
  ]);
  const before=JSON.stringify(home),mesh=buildRoomWalls(home);
  const diagonal=mesh.edges.filter(e=>e.wallId==='diagonal');
  assert.equal(diagonal.length,1);
  assert.deepEqual(diagonal[0].a,{x:460,y:500});assert.deepEqual(diagonal[0].b,{x:700,y:370});
  assert.equal(diagonal[0].height,70);
  const caps=mesh.surfaces.filter(s=>s.kind==='cap'&&s.height===70);
  assert.ok(caps.every(s=>s.original.flat(2).every(([x,y])=>y<=410||x<=110||x>=450)),'no detached cap triangle crosses into the room left of the vertical wall');
  assert.ok(contains(mesh.silhouette,{x:460,y:470}),'the shared vertical return stays connected');
  assert.ok(contains(mesh.rim,{x:462,y:470}),'the vertical divider keeps its visible strip down to the front border');
  assert.ok(!caps.some(s=>contains(s.geometry,{x:400,y:450})),'the neighboring floor is not covered by a warped cap');
  assert.doesNotMatch(wallGeometryPath(mesh.silhouette),/NaN|Infinity/);
  assert.equal(JSON.stringify(home),before);
});

test('decorate anchors a diagonal to the same low-front and raised-corner junctions as Build',()=>{
  const home=homeWith([
    {id:'vertical',points:[{x:460,y:100},{x:460,y:500}]},
    {id:'horizontal',points:[{x:460,y:370},{x:700,y:370}]},
    // Build's thick stroke joins this 3px offset to the same visible corner.
    {id:'diagonal',points:[{x:460,y:500},{x:700,y:373}]},
  ]);
  home.openings=[{id:'window-a',type:'window',x:580,y:436.5,angle:Math.atan2(-127,240)*180/Math.PI},{id:'window-b',type:'window',x:615,y:436.5-35*127/240,angle:Math.atan2(-127,240)*180/Math.PI}];
  const before=JSON.stringify(home),mesh=buildRoomWalls(home);
  const source=mesh.edges.find(e=>e.wallId==='diagonal'),display=mesh.projectedEdges.find(e=>e.wallId==='diagonal');
  assert.deepEqual(source.a,{x:460,y:500});assert.deepEqual(source.b,{x:700,y:373});
  assert.deepEqual({x:display.a.x,y:display.a.y-70},{x:460,y:494},'the thin top edge reaches the low front corner, not the side wall above it');
  assert.deepEqual({x:display.b.x,y:display.b.y-70},{x:700,y:300},'the other end shares the horizontal divider corner with no visible gap');
  for(const p of [{x:460,y:493.9},{x:700,y:300}])assert.ok(contains(mesh.rim,p),'both displayed junctions belong to the connected rim');
  assert.equal(mesh.openings.length,1,'neighboring windows still merge');
  assert.ok(distanceToSegment(mesh.openings[0],display.a,display.b)<.001,'the merged window follows the displayed divider instead of returning to the source line');
  assert.equal(display.height,70,'the entire wall keeps one extrusion height');
  assert.equal(JSON.stringify(home),before,'corner registration does not edit the saved floor plan');
});

test('free and shared diagonal joins both leave one uninterrupted front border',()=>{
  const home=homeWith([
    {id:'left-diagonal',points:[{x:160,y:100},{x:300,y:500}]},
    {id:'shared',points:[{x:460,y:100},{x:460,y:500}]},
    {id:'right-diagonal',points:[{x:460,y:500},{x:700,y:370}]},
  ]);
  const before=JSON.stringify(home),mesh=buildRoomWalls(home);
  const raised=mesh.surfaces.filter(s=>s.height>0);
  for(const x of [295,300,305,320,325,330,456,460,464]){
    assert.ok(contains(mesh.rim,{x,y:500}),'the front border remains continuous under both diagonals');
    assert.equal(raised.some(s=>contains(s.original,{x,y:500})),false,'no raised face or cap is drawn through the front band');
  }
  assert.ok(contains(mesh.rim,{x:462,y:470}),'the vertical strip remains visible below the diagonal junction');
  assert.ok(contains(mesh.silhouette,{x:462,y:470}),'removing an end seam does not remove the wall itself');
  assert.equal(JSON.stringify(home),before,'both diagonals retain their exact floor-plan positions');
});

test('a branch meeting either diagonal direction has a smooth miter instead of a square-cap notch',()=>{
  for(const direction of [1,-1]){
    const home=homeWith([
      {id:'diagonal',points:[{x:200,y:300-direction*200},{x:600,y:300+direction*200}]},
      {id:'branch',points:[{x:400,y:100},{x:400,y:300}]},
    ]);
    const before=JSON.stringify(home),mesh=buildRoomWalls(home);
    const formerBump={x:400-direction*3.2,y:233.2};
    assert.equal(mesh.surfaces.some(s=>s.kind==='cap'&&s.height===70&&contains(s.original,formerBump)),false,'the branch cannot protrude beyond the diagonal cap edge');
    assert.ok(contains(mesh.faces,{x:400,y:260}),'adjoining wall faces form one filled surface');
    const p={x:400,y:260};
    const distances=mesh.faces.flatMap(poly=>poly.flatMap(ring=>ring.slice(1).map(([x,y],i)=>distanceToSegment(p,{x:ring[i][0],y:ring[i][1]},{x,y}))));
    assert.ok(Math.min(...distances)>10,'no individual face boundary crosses the merged wall face');
    assert.doesNotMatch(wallGeometryPath(mesh.faces),/NaN|Infinity/);
    assert.equal(JSON.stringify(home),before,'mitering never edits the saved floor-plan points');
  }
});

test('mitered T junctions fill their centre instead of outlining a triangular hole',()=>{
  const home=homeWith([
    {id:'upper',points:[{x:400,y:100},{x:400,y:300}]},
    {id:'lower',points:[{x:400,y:300},{x:400,y:500}]},
    {id:'branch',points:[{x:400,y:300},{x:700,y:300}]},
  ]);
  const mesh=buildRoomWalls(home),p={x:400,y:230};
  assert.ok(contains(mesh.rim,p),'the shared node is solid cap material');
  const distances=mesh.rim.flatMap(poly=>poly.flatMap(ring=>ring.slice(1).map(([x,y],i)=>distanceToSegment(p,{x:ring[i][0],y:ring[i][1]},{x,y}))));
  assert.ok(Math.min(...distances)>3,'no triangular outline cuts through the junction centre');
});

test('a low front window cannot notch the tall diagonal meeting that border',()=>{
  const home=homeWith([
    {id:'vertical',points:[{x:400,y:100},{x:400,y:500}]},
    {id:'diagonal',points:[{x:400,y:500},{x:700,y:350}]},
  ]);
  const plain=buildRoomWalls(home);
  const mesh=buildRoomWalls({...home,openings:[{id:'front-window',type:'window',x:440,y:500,angle:180}]});
  assert.equal(mesh.openings[0].height,0);
  assert.deepEqual(mesh.faces,plain.faces,'the low opening cuts only its supporting border, not the adjoining wall face');
  assert.equal(mesh.surfaces.some(s=>s.kind==='cap'&&s.height===0&&contains(s.geometry,{x:440,y:500})),false,'the front window still cuts the low border');
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
