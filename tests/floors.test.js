import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {initialHome,normalizePlan,rectangleFromPoints} from '../src/model.js';
import {floorDescriptors,floorHome,stackLayers} from '../src/floors.js';
import {deleteSelection,emptySelection,moveSelection,selectInBox,selectionBounds,selectionCount} from '../src/editor.js';

function complex(count=12){
  return normalizePlan({...initialHome(),sections:Array.from({length:count},(_,i)=>({id:`floor-${i}`,level:i+1,points:rectangleFromPoints({x:100+i*800,y:200},{x:700+i*800,y:650})})),stairs:[{id:'stair',kind:'quarter-landing',x:500,y:450,rotation:0,scale:1,toLevel:2}],items:[{id:'sofa-1',type:'sofa',x:300,y:400,scale:1,rotation:0},{id:'sofa-2',type:'sofa',x:1100,y:400,scale:1,rotation:0}]});
}
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/FloorViews.jsx',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,external:['react']});
// Data-URL modules cannot resolve bare React, so use the repository's URL.
const code=bundle.outputFiles[0].text.replaceAll('from "react"',`from "${new URL('../node_modules/react/index.js',import.meta.url).href}"`);
const {FloorStack,FloorOverview}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));

test('a large complex renders exactly one active floor and one adjacent ghost',()=>{
  const home=complex(30);
  for(const level of [1,2,15,30]){
    const markup=render(FloorStack,{home,level});
    assert.equal((markup.match(/class="active-floor"/g)||[]).length,1);
    assert.equal((markup.match(/class="adjacent-floor /g)||[]).length,1);
    assert.equal((markup.match(/class="topdown-room"/g)||[]).length,level===1?1:2);
    if(level===1){assert.match(markup,/class="adjacent-floor adjacent-above"[^>]*opacity=".18"/);assert.match(markup,/upper-floor-blueprint/);}
    else assert.match(markup,/class="adjacent-floor adjacent-below"[^>]*opacity=".45"/);
    assert.doesNotMatch(markup,/NaN|Infinity/);
  }
});
test('stack registration aligns floor origins and keeps floor contents isolated',()=>{
  const home=complex(),layers=stackLayers(home,2),upper=floorHome(home,layers.active);
  assert.equal(layers.offset.x,-800);assert.equal(layers.adjacentOffset.x,800);
  assert.deepEqual(upper.items.map(i=>i.id),['sofa-2']);assert.equal(upper.sections.length,1);
  assert.deepEqual(upper.floorLevels,[2]);
  const markup=render(FloorStack,{home,level:2});assert.match(markup,/class="stairwell-rim"/);
});
test('blueprint overview only mounts four floors in its current sheet',()=>{
  const markup=render(FloorOverview,{home:complex(20),activeLevel:1});
  assert.equal((markup.match(/class="floor-plan"/g)||[]).length,4);
  assert.match(markup,/Sheet 1 \/ 5/);
});
test('stairs participate in box selection, move, bounds and deletion without moving furniture',()=>{
  const home=complex(),selection={...emptySelection(),stairs:['stair']},before=selectionBounds(home,selection);
  assert.equal(selectionCount(selection),1);assert.deepEqual(selectInBox(home,{x:470,y:420,width:60,height:60}).stairs,['stair']);
  const moved=moveSelection(home,selection,{x:35,y:25}),after=selectionBounds(moved,selection);
  assert.equal(moved.stairs[0].x,535);assert.equal(moved.stairs[0].y,475);assert.equal(home.stairs[0].x,500);
  assert.equal(after.x,before.x+35);assert.equal(after.y,before.y+25);assert.deepEqual(moved.items,home.items);
  assert.equal(deleteSelection(moved,selection).stairs.length,0);
  assert.equal(floorDescriptors(home).length,12);
});
