import test from 'node:test';
import assert from 'node:assert/strict';
import {addFloorSection,initialHome,normalizePlan,rectangleFromPoints} from '../src/model.js';
import {floorDescriptors,previousFloorBlueprint,stackLayers} from '../src/floors.js';
import {floorOverhang} from '../src/floorSupport.js';
import {emptySelection,moveSelection,moveVertex,resizeOutline} from '../src/editor.js';

const rect=(x,y,w,h)=>rectangleFromPoints({x,y},{x:x+w,y:y+h});
const section=(id,level,points)=>({id,level,points});

test('larger upper floors keep their exact shape and belongings',()=>{
  const upper=rect(1000,100,600,400),item={id:'sofa',type:'sofa',x:1300,y:300,scale:1,rotation:0};
  const home=normalizePlan({...initialHome(),sections:[section('base',1,rect(100,100,300,200)),section('upper',2,upper)],items:[item],floorFitWarnings:[{level:2,belowLevel:1}]});
  assert.deepEqual(home.sections.find(s=>s.level===2).points,upper);
  assert.deepEqual(home.items,[item]);assert.equal(home.floorFitWarnings,undefined);
  assert.equal(floorDescriptors(home).find(f=>f.level===2).width,600);
  assert.equal(floorOverhang(home,2).area,72);
  assert.deepEqual(normalizePlan(home),home);
});
test('a previous-floor reference is the whole merged perimeter with no contents',()=>{
  const l=[{x:100,y:100},{x:400,y:100},{x:400,y:200},{x:200,y:200},{x:200,y:400},{x:100,y:400}];
  const home=normalizePlan({...initialHome(),sections:[section('base',1,l),section('upper',2,rect(1000,100,300,200)),section('top',3,rect(2000,100,500,500))]});
  assert.equal(previousFloorBlueprint(home,1),null);
  const reference=previousFloorBlueprint(home,2);
  assert.equal(reference.level,1);assert.equal(reference.ring.length,6);
  assert.deepEqual(Object.keys(reference).sort(),['level','ring']);
  assert.equal(previousFloorBlueprint(home,3).level,2);
  assert.equal(previousFloorBlueprint(home,4,{x:3000,y:200}).level,3);
});
test('overhang reminders use footprint differences, not square-footage comparison',()=>{
  const l=[{x:100,y:100},{x:400,y:100},{x:400,y:200},{x:200,y:200},{x:200,y:400},{x:100,y:400}];
  const home=normalizePlan({...initialHome(),sections:[section('base',1,l),section('upper',2,rect(1000,100,200,200))]});
  // 16 m² upstairs versus 20 m² below still leaves 4 m² over the L's notch.
  assert.equal(floorOverhang(home,2).area,4);
  assert.equal(floorOverhang(home,1),null);
});
test('reference alignment preserves previously saved registration offsets',()=>{
  const home=normalizePlan({...initialHome(),sections:[section('base',1,rect(100,100,300,300)),section('upper',7,rect(1000,100,100,100))],floorOffsets:{7:{x:30,y:40}}});
  const reference=previousFloorBlueprint(home,7);
  assert.equal(Math.min(...reference.ring.map(p=>p.x)),970);
  assert.equal(Math.min(...reference.ring.map(p=>p.y)),60);
  assert.equal(floorOverhang(home,7),null);
});

const twoFloors=()=>normalizePlan({...initialHome(),sections:[section('base',1,rect(100,100,300,300)),section('upper',2,rect(1000,100,300,300))]});
test('moving an upper plan leaves its previous-floor reference fixed',()=>{
  const home=twoFloors(),before=previousFloorBlueprint(home,2),registration=stackLayers(home,2).offset;
  const moved=moveSelection(home,{...emptySelection(),sections:['upper']},{x:120,y:60});
  assert.deepEqual(previousFloorBlueprint(moved,2),before);
  assert.deepEqual(moved.floorOrigins,home.floorOrigins);
  assert.equal(floorDescriptors(moved).find(f=>f.level===2).x,1120);
  assert.deepEqual(stackLayers(moved,2).offset,registration,'Decorate must not cancel the plan translation');
  assert.ok(floorOverhang(moved,2).area>0);
  const reloaded=normalizePlan(JSON.parse(JSON.stringify(moved)));
  assert.deepEqual(previousFloorBlueprint(reloaded,2),before);
  assert.deepEqual(reloaded.floorOrigins,home.floorOrigins);
});
test('resizing or reshaping an upper plan also leaves the reference origin fixed',()=>{
  const home=twoFloors(),reference=previousFloorBlueprint(home,2);
  const resized=resizeOutline(home,0,{x:950,y:50},{sectionId:'upper'});
  assert.deepEqual(previousFloorBlueprint(resized,2),reference);
  const reshaped=moveVertex(home,'section:upper',0,{x:1040,y:120});
  assert.deepEqual(previousFloorBlueprint(reshaped,2),reference);
});
test('moving the lower plan changes neither the upstairs reference nor the comparison footprint',()=>{
  const home=twoFloors(),reference=previousFloorBlueprint(home,2);
  const moved=moveSelection(home,{...emptySelection(),sections:['base']},{x:60,y:20});
  const next=previousFloorBlueprint(moved,2);
  assert.deepEqual(next,reference);
  assert.deepEqual(moved.floorOrigins[2],home.floorOrigins[2]);
  assert.equal(floorDescriptors(moved).find(f=>f.level===2).x,1000);
  assert.equal(floorOverhang(moved,2),null,'moving the source sheet must not change the shape-only reference');
});

test('source resizing changes the reference shape without importing its workspace position',()=>{
  const home=twoFloors(),reference=previousFloorBlueprint(home,2);
  const shifted=moveSelection(home,{...emptySelection(),sections:['base']},{x:-200,y:140});
  const resized=resizeOutline(shifted,2,{x:300,y:540},{sectionId:'base'});
  const next=previousFloorBlueprint(resized,2);
  assert.equal(Math.min(...next.ring.map(p=>p.x)),Math.min(...reference.ring.map(p=>p.x)));
  assert.equal(Math.min(...next.ring.map(p=>p.y)),Math.min(...reference.ring.map(p=>p.y)));
  assert.equal(Math.max(...next.ring.map(p=>p.x))-Math.min(...next.ring.map(p=>p.x)),400);
  assert.equal(Math.max(...next.ring.map(p=>p.y))-Math.min(...next.ring.map(p=>p.y)),300);
});

test('the lower sheet registration offset does not move its upstairs shape reference',()=>{
  const home=twoFloors(),reference=previousFloorBlueprint(home,2);
  assert.deepEqual(previousFloorBlueprint({...home,floorOffsets:{1:{x:80,y:-50}}},2),reference);
});
test('the new-floor drawing guide keeps the same origin after its plan is created',()=>{
  const base=normalizePlan({...initialHome(),sections:[section('base',1,rect(100,100,300,300))]});
  const origin={x:1000,y:100},before=previousFloorBlueprint(base,2,origin);
  const created=normalizePlan(addFloorSection(base,rect(1080,160,200,200),'rectangle',origin));
  assert.deepEqual(created.floorOrigins[2],origin);
  assert.deepEqual(previousFloorBlueprint(created,2),before);
});
