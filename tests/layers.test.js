import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedObjects,reorderObjects} from '../src/layers.js';

const sample=()=>({items:[{id:'sofa'},{id:'sticker'},{id:'plant'}],stairs:[{id:'stairs'}]});
const order=home=>orderedObjects(home).map(e=>e.object.id);
test('stairs, furniture and stickers share a persistent decoration order',()=>{
  const home=sample(),moved=reorderObjects(home,['stairs'],'forward');
  assert.deepEqual(order(moved),['sofa','stairs','sticker','plant']);
  assert.deepEqual(order(reorderObjects(moved,['sticker'],'backward')),['sofa','sticker','stairs','plant']);
  assert.deepEqual(order(home),['stairs','sofa','sticker','plant']);
});
test('lowering an object stops at the lowest decoration, never the architecture',()=>{
  let home=sample();
  for(let i=0;i<8;i++)home=reorderObjects(home,['plant'],'backward');
  assert.deepEqual(order(home),['plant','stairs','sofa','sticker']);
  assert.deepEqual(home.stairs,[{id:'stairs'}]);
});
test('layer controls skip hidden floors and move mixed selections together',()=>{
  const home={...sample(),objectOrder:['stairs','plant','sofa','sticker']};
  const moved=reorderObjects(home,['stairs','sofa'],'forward',['stairs','sofa','sticker']);
  assert.deepEqual(order(moved),['sticker','plant','stairs','sofa']);
});
test('locked objects cannot be reordered but other objects can pass them',()=>{
  const home={items:[{id:'a',locked:true},{id:'b'}],stairs:[]};
  assert.strictEqual(reorderObjects(home,['a'],'forward'),home);
  assert.deepEqual(order(reorderObjects(home,['b'],'backward')),['b','a']);
});

test('Build ignores saved decoration-layer ordering',()=>{
  const home=sample(),moved=reorderObjects(home,['stairs'],'forward');
  const planOrder=h=>orderedObjects(h,{useLayers:false}).map(e=>e.object.id);
  assert.deepEqual(planOrder(home),planOrder(moved));
});
