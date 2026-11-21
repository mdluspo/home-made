import test from 'node:test';
import assert from 'node:assert/strict';
import {initialHome} from '../src/model.js';
import {transformFurniture} from '../src/editor.js';

const homeWith=(...items)=>({...initialHome(),items:items.map(i=>({type:'chair',x:300,y:300,scale:1,rotation:0,...i}))});
test('rotation visits all eight compass directions and wraps back to zero',()=>{
  let home=homeWith({id:'chair'});
  for(const angle of [45,90,135,180,225,270,315,0]){home=transformFurniture(home,['chair'],'rotate');assert.equal(home.items[0].rotation,angle);}
  home=transformFurniture(home,['chair'],'rotateBack');assert.equal(home.items[0].rotation,315);
  home=transformFurniture(home,['chair'],'rotate');assert.equal(home.items[0].rotation,0);
  assert.equal(transformFurniture(homeWith({id:'chair',rotation:15}),['chair'],'rotate').items[0].rotation,45);
});
test('furniture transforms preserve positions and leave locked pieces unchanged',()=>{
  const home=homeWith({id:'chair'},{id:'locked',locked:true}),flipped=transformFurniture(home,['chair','locked'],'flip');
  assert.equal(flipped.items[0].flipped,true);assert.deepEqual(flipped.items[1],home.items[1]);
  assert.equal(flipped.items[0].x,300);assert.equal(home.items[0].flipped,undefined);
  assert.equal(transformFurniture(flipped,['chair'],'flip').items[0].flipped,false);
  assert.equal(transformFurniture(home,['locked'],'rotate'),home);
});
test('layer controls move a selected group one place and preserve its internal order',()=>{
  const home=homeWith(...['a','b','c','d','e'].map(id=>({id}))),ids=h=>h.items.map(i=>i.id);
  assert.deepEqual(ids(transformFurniture(home,['b','c'],'forward')),['a','d','b','c','e']);
  assert.deepEqual(ids(transformFurniture(home,['b','c'],'backward')),['b','c','a','d','e']);
  assert.deepEqual(ids(transformFurniture(home,['e'],'forward')),ids(home));
  assert.deepEqual(ids(home),['a','b','c','d','e']);
});
