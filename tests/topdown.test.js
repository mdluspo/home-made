import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {CATALOG,initialHome,normalizePlan,rectangleFromPoints} from '../src/model.js';

const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/TopDown.jsx',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shared-react',setup(build){build.onResolve({filter:/^react$/},()=>({path:new URL('../node_modules/react/index.js',import.meta.url).href,external:true}));}}]});
const {TopDownRoom,TopDownFurniture,TopDownCharacter}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const render=(Component,props)=>renderToStaticMarkup(React.createElement('svg',null,React.createElement(Component,props)));

test('the furnished room uses the floor-plan outline without an isometric transform',()=>{
  const home=normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:150},{x:700,y:500})});
  const markup=render(TopDownRoom,{home});
  assert.match(markup,/M100,150 L700,150 L700,500 L100,500 Z/);
  assert.doesNotMatch(markup,/matrix\(|skew|world-structure/);
});

test('doors and windows sit at their wall coordinates and the leaf opens around its hinge',()=>{
  const home=normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:150},{x:700,y:500}),openings:[{id:'d',type:'door',x:400,y:150,angle:0,open:true},{id:'w',type:'window',x:700,y:350,angle:90}]});
  const markup=render(TopDownRoom,{home});
  assert.match(markup,/class="topdown-opening topdown-door"/);
  assert.match(markup,/transform="translate\(400 150\) rotate\(0\)"/);
  assert.match(markup,/class="door-leaf upright-door"/);
  assert.match(markup,/class="topdown-opening topdown-window side-opening"/);
  assert.match(markup,/class="side-window-pane"/);
  assert.notEqual(markup,render(TopDownRoom,{home:{...home,openings:home.openings.map(o=>({...o,open:false}))}}));
});
test('side doors stay aligned to their raised side walls without a floating frontal panel',()=>{
  const home=normalizePlan({...initialHome(),floor:'rose',boundary:rectangleFromPoints({x:100,y:150},{x:700,y:500}),openings:[{id:'door',type:'door',x:700,y:350,angle:90,open:false}]});
  const markup=render(TopDownRoom,{home});
  assert.match(markup,/class="wall-silhouette"/);
  assert.match(markup,/class="joined-wall-cap" data-height="70"/);
  assert.match(markup,/class="topdown-opening topdown-door side-opening" data-wall-height="70"/);
  assert.match(markup,/class="door-leaf side-door" data-plan-angle="90"/);
  assert.match(markup,/class="side-door-jamb"/);
  assert.doesNotMatch(markup,/translate\(700 371\)|side-door-recess/);
  assert.doesNotMatch(markup,/stroke="#c3a092"|stroke-width="18"|NaN/);
});
test('side doors follow the wall thickness and hinge direction instead of using a front-facing panel',()=>{
  for(const angle of [90,-90]){
    const home=normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:150},{x:700,y:500}),openings:[{id:'door',type:'door',x:700,y:350,angle,open:false}]});
    const closed=render(TopDownRoom,{home}),open=render(TopDownRoom,{home:{...home,openings:home.openings.map(o=>({...o,open:true}))}});
    assert.match(closed,new RegExp(`class="door-leaf side-door" data-plan-angle="${angle}"`));
    assert.match(open,new RegExp(`class="door-leaf side-door" data-plan-angle="${angle+70}"`));
    assert.doesNotMatch(open,/skewY|side-door-recess/);
  }
});

test('a centered side door and window stay centered along the visible wall cap',()=>{
  for(const type of ['door','window'])for(const angle of [90,-90]){
    const home=normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:150},{x:700,y:500}),openings:[{id:'opening',type,x:700,y:325,angle,open:false}]});
    const markup=render(TopDownRoom,{home}),cls=type==='door'?'side-door-top':'side-window-pane';
    const d=markup.match(new RegExp(`class="${cls}" d="([^"]+)"`))[1];
    const points=[...d.matchAll(/(-?[\d.e+-]+),(-?[\d.e+-]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
    assert.equal(points.length,4);
    assert.ok(Math.abs(points.reduce((sum,p)=>sum+p.x,0)/4-700)<.001);
    assert.ok(Math.abs(points.reduce((sum,p)=>sum+p.y,0)/4-255)<.001,'the opening uses the same elevation as its wall, preserving its plan position');
  }
});
test('the back is raised while the front remains an open floor-level border',()=>{
  const home=normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:150},{x:700,y:500})});
  const markup=render(TopDownRoom,{home});
  assert.match(markup,/class="wall-face" data-height="70"/);
  assert.match(markup,/class="joined-wall-cap" data-height="70"/);
  assert.match(markup,/class="joined-wall-cap" data-height="0"/);
  assert.doesNotMatch(markup,/class="wall-face" data-height="0"/);
  assert.match(markup,/class="continuous-wall-rim"/);
  assert.match(markup,/class="continuous-wall-rim"[^>]*stroke="#748164" stroke-width="1.5"/);
  assert.match(markup,/class="wall-caps"/);
});

test('an open door has a transparent opening and clips its leaf to the doorway',()=>{
  const home=normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:150},{x:700,y:500}),openings:[{id:'door',type:'door',x:400,y:150,angle:0,open:true}]});
  const markup=render(TopDownRoom,{home});
  assert.match(markup,/class="doorway-leaf-limit"/);
  assert.match(markup,/clip-path="url\(#[^"]+-portal\)"/);
  assert.doesNotMatch(markup,/fill="#827e61"|fill="#b3ad8a"/);
});
test('a joined divider keeps the same wall height at both ends',()=>{
  const home=normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:150},{x:700,y:500}),walls:[{id:'divider',points:[{x:100,y:300},{x:700,y:300}]}]});
  const markup=render(TopDownRoom,{home});
  assert.match(markup,/class="joined-wall-cap" data-height="70"/);
  assert.doesNotMatch(markup,/wall-skirting|previousHeight|NaN/);
});

test('built-in furniture uses three-quarter overhead art with visible fronts and grounded shadows',()=>{
  for(const item of CATALOG){const markup=render(TopDownFurniture,{type:item.type});assert.match(markup,new RegExp('sprite-'+item.type));assert.match(markup,/data-perspective="three-quarter"/);assert.doesNotMatch(markup,/<image/);if(item.type!=='rug'){assert.match(markup,/sprite-front-face/);assert.match(markup,/sprite-ground-shadow/);}}
  assert.match(render(TopDownFurniture,{type:'custom',custom:{src:'data:image/png;base64,dGVzdA=='}}),/<image/);
});

test('exploration places the character directly in the plan coordinate system',()=>{
  const markup=render(TopDownCharacter,{x:350,y:260,color:'#aabb88',name:'Old name',sitting:true});
  assert.match(markup,/transform="translate\(350 260\)"/);
  assert.match(markup,/<circle r="12" fill="#aabb88"/);
  assert.match(markup,/>player<\/text>/);
  assert.doesNotMatch(markup,/<path|<ellipse|Old name/);
});
