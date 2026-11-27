import test from 'node:test';
import assert from 'node:assert/strict';
import { initialHome, normalizePlan, rectangleFromPoints } from '../src/model.js';
import { deleteSelection, emptySelection, moveSelection, moveVertex, selectInBox, selectionBounds, selectionCount } from '../src/editor.js';

function sample(){return normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:200,y:150},{x:800,y:550}),walls:[{id:'a',points:[{x:200,y:350},{x:500,y:350}]},{id:'b',points:[{x:500,y:350},{x:800,y:350}]},{id:'c',points:[{x:500,y:150},{x:500,y:350}]}],items:[{id:'plant',type:'plant',x:300,y:230,scale:1,rotation:0}]});}
test('drag-box selection includes intersecting walls without selecting an entire partially covered footprint',()=>{
  const s=selectInBox(sample(),{x:250,y:300,width:380,height:100});
  assert.equal(s.boundary,false);assert.equal(s.walls.length,3);assert.equal(selectionCount(s),3);
});
test('moving a selected floor plan moves its walls, belongings, and bounds in the live draft',()=>{
  const home=sample(),s={...emptySelection(),boundary:true};
  const before=selectionBounds(home,s),draft=moveSelection(home,s,{x:80,y:40}),after=selectionBounds(draft,s);
  assert.equal(after.x,before.x+80);assert.equal(after.y,before.y+40);
  assert.equal(draft.items[0].x,home.items[0].x+80);assert.equal(draft.walls[0].points[0].y,home.walls[0].points[0].y+40);
  assert.equal(home.boundary[0].x,200,'preview must not mutate saved geometry');
});
test('moving one divider endpoint leaves every neighboring divider independent',()=>{
  const home=sample(),draft=moveVertex(home,'a',1,{x:540,y:390});
  const at=draft.walls.flatMap(w=>w.points).filter(p=>p.x===540&&p.y===390);
  assert.equal(at.length,1);
  assert.deepEqual(draft.walls.find(w=>w.id==='b'),home.walls.find(w=>w.id==='b'));
  assert.deepEqual(draft.walls.find(w=>w.id==='c'),home.walls.find(w=>w.id==='c'));
});
test('moving a divider translates only that placed wall without pinning its ends',()=>{
  const home=sample(),draft=moveSelection(home,{...emptySelection(),walls:['a']},{x:30,y:20});
  assert.deepEqual(draft.walls.find(w=>w.id==='a').points[0],{x:230,y:370});
  assert.deepEqual(draft.walls.find(w=>w.id==='b'),home.walls.find(w=>w.id==='b'));
});

test('dragging a freehand divider body translates all its points and its attached opening',()=>{
  const home=normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:200,y:150},{x:800,y:550}),walls:[{id:'curve',curved:true,curveMode:'three-point',points:[{x:300,y:230},{x:450,y:280},{x:600,y:250}]}],openings:[{id:'door',type:'door',x:450,y:280,angle:0}]});
  const original=home.walls.find(w=>w.id==='curve'),delta={x:25,y:40};
  const draft=moveSelection(home,{...emptySelection(),walls:['curve']},delta);
  assert.deepEqual(draft.walls.find(w=>w.id==='curve').points,original.points.map(p=>({x:p.x+25,y:p.y+40})));
  assert.deepEqual(draft.boundary,home.boundary);
  assert.equal(draft.openings[0].x,475);assert.equal(draft.openings[0].y,320);
  const adjusted=moveVertex(home,'curve',0,{x:320,y:240});
  assert.deepEqual(adjusted.walls.find(w=>w.id==='curve').points.slice(1),original.points.slice(1),'an end-handle drag edits that end instead of translating the body');
});
test('deleting a selected group removes precisely that group',()=>{
  const home=sample(),draft=deleteSelection(home,{...emptySelection(),walls:['a','c'],items:['plant']});
  assert.deepEqual(draft.walls.map(w=>w.id),['b']);assert.equal(draft.items.length,0);assert.deepEqual(draft.boundary,home.boundary);
});
test('dragging a divider endpoint on the exterior never edits the base outline',()=>{
  const home=sample(),draft=moveVertex(home,'a',0,{x:250,y:390});
  assert.deepEqual(draft.boundary,home.boundary);
  assert.deepEqual(draft.sections,home.sections);
  assert.deepEqual(draft.outlines,home.outlines);
  assert.deepEqual(draft.walls.find(w=>w.id==='a').points[0],{x:250,y:390});
});
test('moving a generated shared divider persists independently of both floor sections',()=>{
  const home=normalizePlan({...initialHome(),sections:[{id:'left',points:rectangleFromPoints({x:100,y:100},{x:400,y:500})},{id:'right',points:rectangleFromPoints({x:400,y:100},{x:700,y:500})}]});
  const join=home.walls.find(w=>w.source==='join');
  for(const draft of [moveSelection(home,{...emptySelection(),walls:[join.id]},{x:40,y:0}),moveVertex(home,join.id,0,{x:440,y:100})]){
    const saved=normalizePlan(draft);
    assert.deepEqual(saved.sections,home.sections);assert.deepEqual(saved.boundary,home.boundary);
    assert.ok(saved.removedJoins.includes(join.joinKey));
    assert.equal(saved.walls.some(w=>w.source==='join'),false);
    assert.ok(saved.walls.flatMap(w=>w.points).some(p=>p.x===440));
    assert.deepEqual(normalizePlan(saved),saved);
  }
});

test('stretching a divider endpoint snaps only to a close wall, including a small overshoot',()=>{
  const home=normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:100},{x:800,y:600}),walls:[{id:'barrier',points:[{x:600,y:100},{x:600,y:600}]},{id:'free',points:[{x:200,y:300},{x:400,y:300}]}]});
  for(const [x,expected] of [[590,600],[610,600],[450,450]]){
    const moved=moveVertex(home,'free',1,{x,y:300});
    assert.ok(Math.abs(moved.walls.find(w=>w.id==='free').points[1].x-expected)<.001);
    assert.deepEqual(moved.boundary,home.boundary);
  }
});
