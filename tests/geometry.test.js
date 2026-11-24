import test from 'node:test';
import assert from 'node:assert/strict';
import { addDivider, canMove, extendDivider, initialHome, migrateHome, normalizePlan, planArea, planToWorld, pointInPolygon, rectangleFromPoints, worldToPlan } from '../src/model.js';

const boundary=rectangleFromPoints({x:200,y:150},{x:800,y:550});
const makeHome=walls=>({...initialHome(),boundary,walls});
const line=(id,a,b)=>({id,curved:false,points:[a,b]});
test('divider endpoints join only when close to the next divider and exterior',()=>{
  const home=normalizePlan(makeHome([line('vertical',{x:500,y:150},{x:500,y:550})]));
  const wall=extendDivider(home,line('short',{x:210,y:350},{x:490,y:350}));
  assert.deepEqual(wall.points,[{x:200,y:350},{x:500,y:350}]);
  const saved=addDivider(home,wall);
  assert.equal(saved.walls.length,3);
  assert.deepEqual(normalizePlan(saved),saved);
});
test('passing a divider does not extend the endpoint across the next room',()=>{
  const home=normalizePlan(makeHome([line('first',{x:400,y:150},{x:400,y:550}),line('next',{x:650,y:150},{x:650,y:550})]));
  const wall=extendDivider(home,line('crossing',{x:200,y:350},{x:480,y:350}));
  assert.deepEqual(wall.points,[{x:200,y:350},{x:480,y:350}]);
  const saved=addDivider(home,wall);
  assert.ok(saved.walls.some(w=>w.points.some(p=>p.x===400&&p.y===350)));
  assert.equal(saved.walls.some(w=>w.id.startsWith('crossing')&&w.points.some(p=>p.x>480&&p.y===350)),false);
});

test('near endpoints retract to a crossed divider or extend to the next close divider',()=>{
  const home=normalizePlan(makeHome([line('first',{x:400,y:150},{x:400,y:550}),line('next',{x:650,y:150},{x:650,y:550})]));
  for(const [end,expected] of [[410,400],[640,650],[660,650],[525,525]]){
    const result=extendDivider(home,line('new',{x:200,y:350},{x:end,y:350}));
    assert.ok(Math.abs(result.points[1].x-expected)<.001);
    assert.equal(result.points[1].y,350);
  }
});
test('a divider ending on a wall stays attached without overshooting',()=>{
  const home=normalizePlan(makeHome([line('stop',{x:500,y:150},{x:500,y:550})]));
  const wall=line('attached',{x:200,y:350},{x:500,y:350});
  assert.deepEqual(extendDivider(home,wall),wall);
});
test('a curved divider snaps only nearby ends along their tangents without moving interior points',()=>{
  const home=normalizePlan(makeHome([])),wall={id:'curve',curved:true,points:[{x:210,y:300},{x:350,y:300},{x:450,y:350},{x:790,y:350}]};
  const extended=extendDivider(home,wall);
  assert.deepEqual(extended.points,[{x:200,y:300},{x:350,y:300},{x:450,y:350},{x:800,y:350}]);
  assert.deepEqual(wall.points[0],{x:210,y:300});
});

test('a new player starts with no floor plan, furniture, walls, or openings',()=>{
  const home=initialHome();
  for(const field of ['boundary','walls','items','openings','custom'])assert.deepEqual(home[field],[]);
  assert.equal(canMove({x:540,y:385},home),false);
});
test('migration removes only the old demo furniture and keeps player-placed pieces',()=>{
  const old={...initialHome(),geometryVersion:undefined,items:[{id:'sofa-initial',type:'sofa',x:400,y:450},{id:'player-piece',type:'plant',x:600,y:450}]};
  const migrated=migrateHome(old);
  assert.equal(migrated.items.length,1);assert.equal(migrated.items[0].id,'player-piece');
  assert.equal(migrateHome(migrated),migrated);
});
test('a divider drawn across the canvas clips to the exterior walls',()=>{
  const home=normalizePlan(makeHome([line('divider',{x:30,y:350},{x:980,y:350})]));
  assert.equal(home.walls.length,1);
  assert.ok(Math.abs(home.walls[0].points[0].x-200)<.001);
  assert.ok(Math.abs(home.walls[0].points.at(-1).x-800)<.001);
  assert.equal(canMove({x:450,y:350},home),false);
  assert.equal(canMove({x:450,y:300},home),true);
});
test('crossing dividers split at a shared junction instead of overlapping strokes',()=>{
  const home=normalizePlan(makeHome([line('horizontal',{x:0,y:350},{x:1000,y:350}),line('vertical',{x:500,y:20},{x:500,y:700})]));
  assert.equal(home.walls.length,4);
  const atJunction=home.walls.filter(w=>[w.points[0],w.points.at(-1)].some(p=>Math.hypot(p.x-500,p.y-350)<.001));
  assert.equal(atJunction.length,4);
  assert.deepEqual(normalizePlan(home),home,'normalization must be stable across repeated edits');
});
test('an irregular floor plan clips the same line into separate interior sections',()=>{
  const shape=[{x:100,y:100},{x:700,y:100},{x:700,y:500},{x:500,y:500},{x:500,y:250},{x:300,y:250},{x:300,y:500},{x:100,y:500}];
  const home=normalizePlan({...initialHome(),boundary:shape,walls:[line('cut',{x:0,y:400},{x:900,y:400})]});
  assert.equal(home.walls.length,2);
  for(const wall of home.walls){const a=wall.points[0],b=wall.points.at(-1);assert.ok(pointInPolygon({x:(a.x+b.x)/2,y:(a.y+b.y)/2},shape));}
});
test('curved dividers retain their shape while exterior portions are trimmed',()=>{
  const home=normalizePlan(makeHome([{id:'curve',curved:true,points:[{x:100,y:300},{x:300,y:280},{x:480,y:350},{x:600,y:380},{x:900,y:400}]}]));
  assert.ok(home.walls[0].curved);assert.ok(home.walls[0].points.length>2);
  assert.ok(home.walls[0].points[0].x>=199.99);assert.ok(home.walls[0].points.at(-1).x<=800.01);
});
test('floor dimensions and illustrated view share the same source geometry',()=>{
  assert.equal(planArea(boundary),96);
  const p={x:375,y:260},roundtrip=worldToPlan(planToWorld(p));
  assert.ok(Math.abs(p.x-roundtrip.x)<1e-8);assert.ok(Math.abs(p.y-roundtrip.y)<1e-8);
});
test('an overlapping wall extension becomes one continuous wall',()=>{
  const home=normalizePlan(makeHome([line('existing',{x:200,y:350},{x:550,y:350}),line('extension',{x:450,y:350},{x:800,y:350})]));
  assert.equal(home.walls.length,1);assert.equal(home.walls[0].points[0].x,200);assert.equal(home.walls[0].points.at(-1).x,800);
});
test('drawing over an exterior edge does not add another wall on top of it',()=>{
  const home=normalizePlan(makeHome([line('duplicate',{x:200,y:150},{x:800,y:150})]));
  assert.equal(home.walls.length,0);
});

test('walking respects the visible top-down furniture footprint after rotation',()=>{
  const home=normalizePlan({...makeHome([]),items:[{id:'bed',type:'bed',x:500,y:350,scale:1,rotation:90}]});
  assert.equal(canMove({x:550,y:350},home),false);
  assert.equal(canMove({x:500,y:400},home),true);
});
