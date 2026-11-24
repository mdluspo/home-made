import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {initialHome,normalizePlan,rectangleFromPoints} from '../src/model.js';
import {floorDescriptors,floorHome,stackLayers} from '../src/floors.js';
import {deleteSelection,emptySelection,moveSelection,selectInBox,selectionBounds,selectionCount} from '../src/editor.js';

function complex(count=12){
  return normalizePlan({...initialHome(),sections:Array.from({length:count},(_,i)=>({id:`floor-${i}`,level:i+1,points:rectangleFromPoints({x:100+i*800,y:200},{x:700+i*800,y:650})})),stairs:[{id:'stair',kind:'quarter-landing',x:500,y:450,rotation:0,scale:1,toLevel:2}],items:[{id:'sofa-1',type:'sofa',x:300,y:400,scale:1,rotation:0},{id:'sofa-2',type:'sofa',x:1100,y:400,scale:1,rotation:0}]});
}
const require=createRequire(import.meta.url);
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/FloorViews.jsx',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'external-ui',setup(build){build.onResolve({filter:/^(react|lucide-react)$/},args=>({path:pathToFileURL(require.resolve(args.path)).href,external:true}));}}]});
// Resolve UI dependencies as files; bundling CommonJS icons into a data URL
// would leave a dynamic require("react") that cannot run in an ES module.
const code=bundle.outputFiles[0].text;
const {BuildPlans,FloorStack,FloorOverview,StairInspector,PreviousFloorBlueprint}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));

test('a large complex renders the active floor and at most one lower floor',()=>{
  const home=complex(30);
  for(const level of [1,2,15,30]){
    const markup=render(FloorStack,{home,level});
    assert.equal((markup.match(/class="active-floor"/g)||[]).length,1);
    assert.equal((markup.match(/class="adjacent-floor /g)||[]).length,level===1?0:1);
    assert.equal((markup.match(/class="topdown-room"/g)||[]).length,level===1?1:2);
    if(level===1)assert.doesNotMatch(markup,/adjacent-above|upper-floor-blueprint/);
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
  const activeMarkup=markup.slice(markup.indexOf('class="active-floor"'));
  assert.ok(activeMarkup.indexOf('class="stair-arrival"')<activeMarkup.indexOf('class="topdown-walls"'),'arrival details belong below upper-floor walls');
  assert.match(activeMarkup,/class="floor-details" clip-path="url\(/);
});
test('blueprint overview only mounts four floors in its current sheet',()=>{
  const markup=render(FloorOverview,{home:complex(20),activeLevel:1});
  assert.equal((markup.match(/class="floor-plan"/g)||[]).length,4);
  assert.match(markup,/Sheet 1 \/ 5/);
});

test('Build shows floor plans without automatically creating reference outlines or overhang notices',()=>{
  const home=complex(3),markup=render(BuildPlans,{home});
  assert.equal((markup.match(/class="floor-plan"/g)||[]).length,3);
  assert.equal((markup.match(/class="previous-floor-blueprint"/g)||[]).length,0);
  assert.doesNotMatch(markup,/floor-support-note/);
  assert.doesNotMatch(markup,/adjacent-floor|stacked-floors/);
  const reference=render(PreviousFloorBlueprint,{home,level:2});
  assert.equal((reference.match(/<path /g)||[]).length,1);
  assert.doesNotMatch(reference,/stair-object|furniture|ROOM/);
});

test('selected Build outlines contain no visible or interactive vertex handles',()=>{
  const home=complex(2),markup=render(BuildPlans,{home,selectedWall:'section:floor-1'});
  assert.doesNotMatch(markup,/point-handle|outline-handle-hit|outline-morph-handles|outline-resize-handle/);
  const proportional=render(BuildPlans,{home,selectedWall:'section:floor-1',outlineEditMode:'proportional'});
  assert.equal(proportional,markup);
});

test('Build dimensions are clickable only when an editing callback is supplied',()=>{
  const home=complex(2),readOnly=render(BuildPlans,{home}),editable=render(BuildPlans,{home,onDimensionEdit:()=>{}});
  assert.doesNotMatch(readOnly,/editable-dimension-label/);
  assert.equal((editable.match(/class="editable-dimension-label"/g)||[]).length,8);
  assert.match(editable,/Set measurement, current 12.00 metres/);
});

test('Build stair settings do not offer decoration-layer buttons',()=>{
  const markup=render(StairInspector,{stair:complex().stairs[0]});
  assert.doesNotMatch(markup,/Send stairs backward|Bring stairs forward/);
  assert.match(render(StairInspector,{stair:complex().stairs[0],onLayer:()=>{}}),/Bring stairs forward/);
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

test('dragging decorations across an exterior wall preserves their original floor',()=>{
  const home=complex(2),picked={...emptySelection(),items:['sofa-1'],stairs:['stair']};
  const moved=moveSelection(home,picked,{x:900,y:-400});
  const floor1=floorHome(moved,floorDescriptors(moved).find(f=>f.level===1));
  const floor2=floorHome(moved,floorDescriptors(moved).find(f=>f.level===2));
  assert.equal(moved.items.find(i=>i.id==='sofa-1').level,1);
  assert.equal(moved.stairs[0].level,1);
  assert.ok(floor1.items.some(i=>i.id==='sofa-1'));assert.equal(floor1.stairs.length,1);
  assert.ok(!floor2.items.some(i=>i.id==='sofa-1'));assert.equal(floor2.stairs.length,0);
  const reloaded=JSON.parse(JSON.stringify(moved));
  assert.ok(floorHome(reloaded,floorDescriptors(reloaded)[0]).items.some(i=>i.id==='sofa-1'));
});

test('legacy decorations just outside the outline remain visible on their nearest floor',()=>{
  const home=complex(2);home.items[0]={...home.items[0],x:95};
  assert.ok(floorHome(home,floorDescriptors(home)[0]).items.some(i=>i.id==='sofa-1'));
  assert.ok(!floorHome(home,floorDescriptors(home)[1]).items.some(i=>i.id==='sofa-1'));
});
