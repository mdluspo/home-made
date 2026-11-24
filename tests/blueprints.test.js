import test from 'node:test';
import assert from 'node:assert/strict';
import {initialHome,normalizePlan,rectangleFromPoints,validateHome} from '../src/model.js';
import {emptySelection,moveSelection,resizeOutline} from '../src/editor.js';
import {blueprintGeometry,changeBlueprintSource,makeBlueprint} from '../src/blueprints.js';
import {floorDescriptors,linkFloorBlueprints,stackLayers,stairTravel} from '../src/floors.js';

const rect=(x,y,w,h)=>rectangleFromPoints({x,y},{x:x+w,y:y+h});
const homeWithBlueprint=()=>{
  const home=normalizePlan({...initialHome(),sections:[{id:'base',level:1,points:rect(100,100,300,200)},{id:'upper',level:2,points:rect(1000,100,200,150)}]});
  return {...home,blueprints:[makeBlueprint(home,1,{x:1600,y:400})]};
};

test('reference objects keep their own position when either source or upper floor moves',()=>{
  const home=homeWithBlueprint(),reference=home.blueprints[0],before=blueprintGeometry(home,reference);
  for(const id of ['base','upper']){
    const moved=moveSelection(home,{...emptySelection(),sections:[id]},{x:180,y:50});
    const after=blueprintGeometry(moved,moved.blueprints[0]);
    assert.deepEqual(after.ring,before.ring);assert.deepEqual(after.bounds,before.bounds);assert.equal(after.source.level,before.source.level);
    assert.deepEqual(moved.blueprints,home.blueprints);
  }
});

test('a reference follows source shape edits but not source position',()=>{
  const home=homeWithBlueprint(),resized=resizeOutline(home,2,{x:500,y:400},{sectionId:'base'});
  const geometry=blueprintGeometry(resized,resized.blueprints[0]);
  assert.deepEqual(geometry.bounds,{x:1600,y:400,width:400,height:300});
  assert.deepEqual(resized.blueprints,home.blueprints);
});

test('source switching and moving a reference never edit real floor geometry or numbering',()=>{
  const home=homeWithBlueprint(),reference=home.blueprints[0],switched=changeBlueprintSource(home,reference.id,2);
  const geometry=blueprintGeometry(switched,switched.blueprints[0]);
  assert.equal(geometry.source.level,2);assert.deepEqual(geometry.bounds,{x:1600,y:400,width:200,height:150});
  const moved={...switched,blueprints:switched.blueprints.map(b=>({...b,x:b.x-120,y:b.y+70}))};
  assert.deepEqual(moved.sections,home.sections);assert.deepEqual(moved.floorLevels,home.floorLevels);assert.equal(moved.nextLevel,home.nextLevel);
  const saved=normalizePlan(JSON.parse(JSON.stringify(moved)));
  assert.deepEqual(saved.blueprints,moved.blueprints);assert.ok(validateHome(saved));
  assert.deepEqual(changeBlueprintSource(home,reference.id,99),home);
});

test('deleted sources leave a selectable snapshot and malformed reference data is rejected',()=>{
  const home=homeWithBlueprint(),reference=home.blueprints[0];
  const missing={...home,sections:home.sections.filter(s=>s.id!=='base')};
  const geometry=blueprintGeometry(missing,reference);
  assert.equal(geometry.source,null);assert.deepEqual(geometry.bounds,{x:1600,y:400,width:300,height:200});
  assert.equal(validateHome({...home,blueprints:[{...reference,x:Infinity}]}),false);
  assert.equal(validateHome({...home,blueprints:[{...reference,outline:[]}]}),false);
});

const alignedHome=()=>{
  const home=normalizePlan({...initialHome(),sections:[{id:'base',level:1,points:rect(100,100,600,500)},{id:'upper',level:2,points:rect(1100,170,200,150)}],stairs:[{id:'stairs',kind:'straight',x:300,y:220,rotation:0,scale:1,toLevel:2}]});
  return linkFloorBlueprints({...home,blueprints:[makeBlueprint(home,1,{x:1000,y:120})]});
};

test('Decorate preserves the exact upper-floor offset inside its lower-floor blueprint',()=>{
  const home=alignedHome(),layers=stackLayers(home,2),upper=floorDescriptors(home).find(f=>f.level===2);
  assert.equal(home.floorBlueprints.upper,home.blueprints[0].id);
  assert.deepEqual(layers.offset,{x:-900,y:-20});
  assert.deepEqual(layers.adjacentOffset,{x:900,y:20});
  assert.equal(upper.x+layers.offset.x,200);assert.equal(upper.y+layers.offset.y,150);
  const moved=linkFloorBlueprints(moveSelection(home,{...emptySelection(),sections:['upper']},{x:50,y:30}));
  assert.deepEqual(stackLayers(moved,2).offset,layers.offset);
  const next=floorDescriptors(moved).find(f=>f.level===2);
  assert.equal(next.x+layers.offset.x,250);assert.equal(next.y+layers.offset.y,180);
});

test('reference alignment chains through more than two floors and survives reload',()=>{
  const home=alignedHome(),three=normalizePlan({...home,sections:[...home.sections,{id:'top',level:3,points:rect(2100,220,100,100)}]});
  const registered=linkFloorBlueprints({...three,blueprints:[...three.blueprints,makeBlueprint(three,2,{x:2000,y:200})]});
  assert.deepEqual(stackLayers(registered,3).offset,{x:-1800,y:-50});
  assert.deepEqual(stackLayers(registered,3).adjacentOffset,{x:900,y:30});
  const reloaded=linkFloorBlueprints(normalizePlan(JSON.parse(JSON.stringify(registered))));
  assert.deepEqual(stackLayers(reloaded,3).offset,stackLayers(registered,3).offset);
  assert.equal(linkFloorBlueprints(reloaded),reloaded);
});

test('stair travel uses the same blueprint registration in both directions',()=>{
  const home=alignedHome(),up=stairTravel(home,1,{x:300,y:220});
  assert.equal(up.level,2);assert.deepEqual(up.position,{x:1200,y:240});
  const down=stairTravel(home,2,up.position);
  assert.equal(down.level,1);assert.deepEqual(down.position,{x:300,y:220});
});

test('overhangs retain their registration and deleting a guide does not move floors',()=>{
  const home=alignedHome(),before=stackLayers(home,2).offset;
  const outside=linkFloorBlueprints(moveSelection(home,{...emptySelection(),sections:['upper']},{x:2000,y:0}));
  assert.equal(outside.floorBlueprints.upper,home.blueprints[0].id);assert.deepEqual(stackLayers(outside,2).offset,before);
  const removed=linkFloorBlueprints({...home,blueprints:[]});
  assert.deepEqual(removed.floorBlueprints,{});assert.deepEqual(stackLayers(removed,2).offset,before);
  assert.deepEqual(removed.sections,home.sections);
});
