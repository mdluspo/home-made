import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {STAIR_TYPES,stairBounds,stairPolygons,stairGeometry,projectStairPoint} from '../src/stairs.js';

const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/Stairs.jsx',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shared-react',setup(build){build.onResolve({filter:/^react$/},()=>({path:new URL('../node_modules/react/index.js',import.meta.url).href,external:true}));}}]});
const {StairArt,StairGlyph,StairObject,StairArrival}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const render=(Component,props)=>renderToStaticMarkup(React.createElement('svg',null,React.createElement(Component,props)));
const stair=kind=>({id:'test-stair',kind,x:230,y:170,rotation:45,scale:1.7});
const area=points=>Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p.x*q.y-q.x*p.y;},0)/2);
const within=(b,p,pad=0)=>p.x>=b.x-pad&&p.x<=b.x+b.width+pad&&p.y>=b.y-pad&&p.y<=b.y+b.height+pad;
const positions=d=>[...d.matchAll(/(-?[\d.e+-]+),(-?[\d.e+-]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
const descendants=element=>!element||typeof element!=='object'?[]:[element,...React.Children.toArray(element.props?.children).flatMap(descendants)];

test('the six named stairs have distinct, finite, non-degenerate tread geometry',()=>{
  assert.deepEqual(STAIR_TYPES.map(t=>t.id),['straight','single-winder','double-winder','spiral','half-landing','quarter-landing']);
  const signatures=new Set();
  for(const {id,name} of STAIR_TYPES) {
    assert.ok(name.length>0);
    const mesh=stairGeometry(stair(id));
    assert.ok(mesh.steps.length>=10);
    signatures.add(JSON.stringify(mesh.steps));
    for(const [i,step] of mesh.steps.entries()) {
      assert.equal(step.z,(i+1)*2);
      assert.ok(area(step.points)>1);
      assert.ok(step.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    }
    for(const rail of mesh.rails)assert.ok(rail.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)));
  }
  assert.equal(signatures.size,6);
});

test('local hole rings tile exactly with their treads, including the semicircular notch',()=>{
  for(const {id} of STAIR_TYPES) {
    const mesh=stairGeometry(stair(id)),rings=stairPolygons(stair(id));
    assert.equal(rings.length,1);
    assert.ok(rings[0].length>=4);
    assert.ok(Math.abs(area(rings[0])-mesh.steps.reduce((s,t)=>s+area(t.points),0))<1e-6,id);
    const altered=stairPolygons(stair(id));altered[0][0].x=9999;
    assert.notEqual(stairPolygons(stair(id))[0][0].x,9999,'callers receive independent point arrays');
  }
  const spiral=stairGeometry({kind:'spiral'});
  for(const p of spiral.footprint) {
    const radius=Math.hypot(p.x,p.y-31);
    assert.ok(Math.abs(radius-14)<1e-7||Math.abs(radius-62)<1e-7);
    assert.ok(p.y<=31+1e-7,'the spiral sweeps only half a circle');
  }
  assert.ok(area(spiral.footprint)<Math.PI*62*62/2,'the center remains open');
});

test('rotation-aware bounds are local and unscaled, enclosing footprint, faces, rails and shadow',()=>{
  for(const {id} of STAIR_TYPES)for(const decorated of [false,true]) {
    const s=stair(id),b=stairBounds(s,{decorated}),mesh=stairGeometry(s);
    assert.deepEqual(b,stairBounds({kind:id,x:-1000,y:4000,rotation:s.rotation,scale:20},{decorated}));
    assert.deepEqual(stairPolygons(s),stairPolygons({kind:id}));
    assert.ok(Object.values(b).every(Number.isFinite)&&b.width>0&&b.height>0);
    for(const p of mesh.footprint)assert.ok(within(b,p));
    if(decorated) {
      for(const t of mesh.steps)for(const p of t.points)for(const z of [t.z,t.z-2])assert.ok(within(b,projectStairPoint(p,z,s.rotation)));
      for(const rail of mesh.rails)for(const p of rail)assert.ok(within(b,projectStairPoint(p,p.z+12,s.rotation)));
      const r=s.rotation*Math.PI/180,c=Math.cos(r),sin=Math.sin(r);
      for(const p of mesh.footprint)for(const dx of [-7.5,7.5])for(const dy of [-7.5,7.5])assert.ok(within(b,{x:p.x+c*(3+dx)+sin*(6+dy),y:p.y-sin*(3+dx)+c*(6+dy)}));
      const markup=render(StairArt,{stair:s,decorated});
      for(const match of markup.matchAll(/ d="([^"]+)"/g))for(const p of positions(match[1]))assert.ok(within(b,p,1e-4),`${id}: rendered path outside bounds`);
    }
  }
});

test('elevation stays screen-vertical at every stair rotation and bounds enclose it',()=>{
  for(const rotation of [0,30,45,90,135,180,225,270,315])for(const {id} of STAIR_TYPES){
    const r=rotation*Math.PI/180,c=Math.cos(r),s=Math.sin(r),bounds=stairBounds({kind:id,rotation},{decorated:true});
    for(const step of stairGeometry({kind:id}).steps)for(const p of step.points){
      const q=projectStairPoint(p,step.z,rotation);
      assert.ok(Math.abs((q.x-p.x)*c-(q.y-p.y)*s)<1e-7,'height must not move sideways on screen');
      assert.ok(Math.abs((q.x-p.x)*s+(q.y-p.y)*c+step.z)<1e-7,'height must rise by z on screen');
      assert.ok(within(bounds,q));
    }
  }
  const markup=render(StairObject,{stair:stair('straight'),decorated:true,destinationLevel:2});
  assert.match(markup,/rotate\(-45\)/,'destination label counter-rotates to stay readable');
});

test('build art and every toolbar icon contain only unfilled strokes and no direction symbols',()=>{
  const glyphs=new Set();
  for(const {id} of STAIR_TYPES) {
    const outline=render(StairArt,{stair:stair(id)}),glyph=render(StairGlyph,{kind:id});
    glyphs.add(glyph);
    assert.match(outline,/stroke="#6c8755"/);
    assert.match(glyph,/width="24" height="24" viewBox="0 0 24 24"/);
    assert.match(glyph,/stroke-width="1.8"/);
    for(const markup of [outline,glyph]) {
      for(const fill of markup.matchAll(/\bfill="([^"]+)"/g))assert.equal(fill[1],'none');
      assert.doesNotMatch(markup,/marker|arrow|<text|<polygon|<image|NaN|Infinity|[←-⇿]/i);
      for(const tag of markup.matchAll(/<(?:path|rect|circle|ellipse)\b[^>]*>/g))assert.match(tag[0],/fill="none"/);
    }
    assert.doesNotMatch(outline,/transform=/,'StairArt leaves world transforms to its parent');
  }
  assert.equal(glyphs.size,6);
});

test('decorated stairs have raised treads, real riser faces, posts, rails and a soft shadow',()=>{
  for(const {id} of STAIR_TYPES) {
    const s=stair(id),markup=render(StairArt,{stair:s,decorated:true});
    assert.match(markup,/data-perspective="three-quarter"/);
    for(const cls of ['stair-riser','stair-tread','stair-stringer','stair-rail-post','stair-handrail','stair-ground-shadow'])assert.match(markup,new RegExp(`class="${cls}"`));
    assert.match(markup,/<feGaussianBlur stdDeviation="2.5"/);
    const elevations=[...markup.matchAll(/data-elevation="([^"]+)"/g)].map(m=>Number(m[1]));
    assert.equal(new Set(elevations).size,stairGeometry(s).steps.length);
    for(const match of markup.matchAll(/class="stair-riser" d="([^"]+)"/g))assert.ok(area(positions(match[1]))>0,'risers are visible faces');
    assert.doesNotMatch(markup,/marker|arrow|NaN|Infinity|<image/i);
  }
  const pair=renderToStaticMarkup(React.createElement('svg',null,...[0,1].map(i=>React.createElement(StairArt,{key:i,stair:stair('straight'),decorated:true}))));
  const ids=[...pair.matchAll(/<filter id="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,2,'multiple stairs do not share shadow filter IDs');
});

test('wrapper applies placement once and forwards pointer and resize events with the stair',()=>{
  const s=stair('double-winder'),calls=[],e={stopPropagation:()=>calls.push('stop')};
  const props={stair:s,selected:true,onPointerDown:(event,value)=>calls.push(['drag',event,value]),onResize:(event,value)=>calls.push(['resize',event,value])};
  const element=StairObject(props);
  element.props.onPointerDown(e);
  assert.deepEqual(calls,['stop',['drag',e,s]]);
  const handles=descendants(element).filter(node=>node.props?.className==='stair-resize-handle');
  assert.equal(handles.length,4);
  handles[0].props.onPointerDown(e);
  assert.deepEqual(calls.slice(2),['stop',['resize',e,s]]);
  const markup=render(StairObject,props);
  assert.match(markup,/transform="translate\(230 170\) rotate\(45\) scale\(1.7\)"/);
  assert.match(markup,/class="stair-hit-area"[^>]*fill="transparent"[^>]*pointer-events="all"/);
  assert.match(markup,/class="stair-selection"[^>]*fill="none"/);
  for(const fill of markup.matchAll(/\bfill="([^"]+)"/g))assert.ok(['none','transparent'].includes(fill[1]));
  assert.doesNotMatch(render(StairObject,{stair:s}),/stair-selection|stair-resize-handle/);
  assert.doesNotThrow(()=>StairObject({stair:s}).props.onPointerDown(e));
});

test('missing or unknown kinds and invalid placements fall back to finite straight art',()=>{
  for(const s of [undefined,{}, {kind:'unknown',x:NaN,y:Infinity,rotation:NaN,scale:-2}]) {
    assert.deepEqual(stairBounds(s),stairBounds({kind:'straight'}));
    assert.doesNotMatch(render(StairObject,{stair:s}),/NaN|Infinity|scale\(-/);
    assert.match(render(StairObject,{stair:s}),/translate\(0 0\) rotate\(0\) scale\(1\)/);
  }
});

test('upper-floor arrivals show a clipped descending flight with a flush landing',()=>{
  for(const {id} of STAIR_TYPES){
    const markup=render(StairArrival,{stair:stair(id),fromLevel:1});
    assert.match(markup,/data-perspective="descending"/);
    assert.match(markup,/aria-label="Stairs from Level 1"/);
    assert.match(markup,/<clipPath/);
    assert.match(markup,/class="stair-arrival-landing"/);
    const depths=[...markup.matchAll(/data-depth="([^"]+)"/g)].map(m=>Number(m[1]));
    assert.equal(depths.length,stairGeometry({kind:id}).steps.length);
    assert.equal(Math.min(...depths),0);assert.ok(Math.max(...depths)>0);
    assert.doesNotMatch(markup,/<text|NaN|Infinity/);
  }
});
