import test from 'node:test';
import assert from 'node:assert/strict';
import {addDivider,initialHome,normalizePlan,rectangleFromPoints,validateHome} from '../src/model.js';
import {moveVertex} from '../src/editor.js';
import {dividerControls,dividerPoints} from '../src/dividers.js';

const homeWith=walls=>normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:100},{x:800,y:600}),walls});

test('legacy crossing fragments restore one selectable original divider',()=>{
  const home=homeWith([
    {id:'original',points:[{x:150,y:300},{x:400,y:300}]},
    {id:'original~split1',points:[{x:400,y:300},{x:700,y:300}]},
    {id:'other',points:[{x:400,y:150},{x:400,y:500}]},
  ]);
  assert.deepEqual(home.walls.map(w=>w.id),['original','other']);
  assert.equal(home.walls[0].points.length,2);
  assert.deepEqual(normalizePlan(home),home);
});

test('a three-point divider starts straight and its middle dot bends only that wall',()=>{
  const home=homeWith([
    {id:'curve',curved:true,curveMode:'three-point',points:[{x:200,y:250},{x:400,y:250},{x:600,y:250}]},
    {id:'neighbor',points:[{x:400,y:150},{x:400,y:500}]},
  ]);
  assert.equal(dividerControls(home.walls[0]).length,3);
  assert.ok(dividerPoints(home.walls[0]).every(p=>Math.abs(p.y-250)<1e-8));
  const next=normalizePlan(moveVertex(home,'curve',1,{x:400,y:350}));
  const curve=next.walls.find(w=>w.id==='curve'),samples=dividerPoints(curve);
  assert.equal(curve.points.length,3);
  assert.deepEqual(samples[samples.length/2|0],{x:400,y:350});
  assert.deepEqual(next.walls.find(w=>w.id==='neighbor'),home.walls.find(w=>w.id==='neighbor'));
  assert.ok(validateHome(next));
});

test('received curves with extra crossing points repair to three controls and keep their endpoint',()=>{
  const curve={id:'old-curve',curved:true,curveMode:'three-point',points:[{x:200,y:250},{x:400,y:350},{x:500,y:300},{x:600,y:250}]};
  const home=homeWith([curve]),repaired=home.walls[0];
  assert.equal(repaired.points.length,3);
  assert.deepEqual(repaired.points,[curve.points[0],curve.points[1],curve.points[3]]);
  assert.deepEqual(dividerPoints(curve).at(-1),curve.points.at(-1));
  assert.ok(validateHome(home));
  assert.deepEqual(normalizePlan(home),home);
});

test('adding an already bent three-point divider does not flatten its middle',()=>{
  const curve={id:'bent',curved:true,curveMode:'three-point',points:[{x:200,y:250},{x:400,y:350},{x:600,y:250}]};
  const next=addDivider(homeWith([]),curve);
  assert.deepEqual(next.walls[0].points,curve.points);
});
