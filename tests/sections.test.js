import test from 'node:test';
import assert from 'node:assert/strict';
import { addFloorSection, initialHome, nextFloorLevel, normalizePlan, planArea, pointInHome, rectangleFromPoints } from '../src/model.js';
import { deleteSelection, emptySelection, moveSelection, moveVertex, outlineBounds, outlineControls, outlineCorners, outlineEdgeControls, resizeOutline } from '../src/editor.js';

const rect=(x,y,w,h)=>rectangleFromPoints({x,y},{x:x+w,y:y+h});
const base=()=>normalizePlan(addFloorSection(initialHome(),rect(100,150,200,200),'rectangle'));
const add=(home,points,type='rectangle')=>normalizePlan(addFloorSection(home,points,type));

test('floor numbers follow persistent creation identity, not polygon area or position',()=>{
  let home=base();
  for(let i=1;i<7;i++)home=add(home,rect(100+i*700,150,80+i*25,100));
  const before=new Map(home.sections.map(s=>[s.id,s.level]));
  assert.deepEqual([...before.values()],[1,2,3,4,5,6,7]);
  home=add(home,rect(-1600,-500,1200,1100));
  for(const [id,level] of before)assert.equal(home.sections.find(s=>s.id===id).level,level);
  assert.equal(home.sections.at(-1).level,8);
  assert.equal(home.floorLevels[0],8,'the largest polygon renders first, but is still Level 8');
  assert.deepEqual(normalizePlan(JSON.parse(JSON.stringify(home))),home,'saved identities survive reload and repeated normalization');
});

test('legacy skipped floor numbers are repaired once, including stairs and registration keys',()=>{
  const legacy={...initialHome(),floorNumberingVersion:undefined,nextLevel:99,sections:[{id:'base',level:1,points:rect(100,100,200,200)},{id:'middle',level:3,points:rect(800,100,200,200)},{id:'top',level:7,points:rect(1500,100,200,200)}],floorOrigins:{1:{x:100,y:100},3:{x:800,y:100},7:{x:1500,y:100}},floorOffsets:{7:{x:20,y:30}},stairs:[{id:'stair',kind:'straight',x:900,y:200,toLevel:7,level:3}]};
  const repaired=normalizePlan(legacy);
  assert.deepEqual(repaired.sections.map(s=>s.level),[1,2,3]);
  assert.deepEqual(repaired.sections.map(s=>s.points),legacy.sections.map(s=>s.points));
  assert.deepEqual(repaired.floorOrigins[3],{x:1500,y:100});assert.deepEqual(repaired.floorOffsets[3],{x:20,y:30});
  assert.equal(repaired.stairs[0].toLevel,3);assert.equal(repaired.stairs[0].level,2);assert.equal(nextFloorLevel(repaired),4);
  assert.deepEqual(normalizePlan(repaired),repaired);
});

test('corner-touching plans keep separate owners and do not consume levels during repeated edits',()=>{
  let home=normalizePlan({...initialHome(),nextLevel:80,sections:[{id:'first',level:1,points:rect(100,100,200,200)},{id:'second',level:2,points:rect(300,300,200,200)}]});
  for(let i=0;i<5;i++){
    home=normalizePlan(home);
    assert.deepEqual(home.sections.map(s=>s.level),[1,2]);
    assert.deepEqual([...home.floorLevels].sort((a,b)=>a-b),[1,2]);
    assert.equal(home.nextLevel,3);assert.equal(nextFloorLevel(home),3);
  }
});

test('joining two floors retains the base number and does not renumber unrelated floors',()=>{
  let home=add(add(base(),rect(500,150,200,200)),rect(900,150,200,200));
  const third=home.sections[2].id,second=home.sections[1].id;
  home=moveSelection(home,{...emptySelection(),sections:[second]},{x:-200,y:0});
  assert.equal(home.sections.find(s=>s.id===third).level,3);
  assert.equal(home.sections.find(s=>s.id===second).level,1);
  home=add(home,rect(1500,150,200,200));
  assert.equal(home.sections.at(-1).level,4);
  assert.equal(home.sections.find(s=>s.id===third).level,3);
});
test('placing a detached floor-plan section keeps both independent shapes',()=>{
  const home=add(base(),rect(500,150,200,200));
  assert.equal(home.sections.length,2);assert.equal(home.outlines.length,2);
  assert.ok(pointInHome({x:150,y:200},home));assert.ok(pointInHome({x:600,y:200},home));assert.equal(pointInHome({x:400,y:200},home),false);
});
test('a nearby section snaps to the first and adds one shared divider',()=>{
  const home=add(base(),rect(312,150,200,200));
  assert.equal(home.sections.length,2);assert.equal(home.outlines.length,1);
  const joins=home.walls.filter(w=>w.source==='join');assert.equal(joins.length,1);
  assert.ok(joins[0].points.every(p=>Math.abs(p.x-300)<.001));
  assert.equal(Math.round(planArea(home.boundary)),32);
});
test('dragging a detached section near the first joins it without replacing either shape',()=>{
  const home=add(base(),rect(500,150,200,200));
  const moved=moveSelection(home,{...emptySelection(),sections:[home.sections[1].id]},{x:-190,y:0});
  assert.equal(moved.sections.length,2);assert.equal(moved.outlines.length,1);assert.equal(moved.walls.filter(w=>w.source==='join').length,1);
});
test('moving a connected section away restores two exterior boundaries and removes the old seam',()=>{
  const home=add(base(),rect(300,150,200,200));
  const moved=moveSelection(home,{...emptySelection(),sections:[home.sections[1].id]},{x:200,y:0});
  assert.equal(moved.outlines.length,2);assert.equal(moved.walls.filter(w=>w.source==='join').length,0);
});
test('overlapping sections retain the earlier section edge as their divider',()=>{
  const home=add(base(),rect(250,150,200,200));
  assert.equal(home.outlines.length,1);
  const joins=home.walls.filter(w=>w.source==='join');assert.equal(joins.length,1);
  assert.ok(joins[0].points.every(p=>Math.abs(p.x-300)<.001));
});

test('deep overlap keeps the complete moving shape and dividers on stationary sides',()=>{
  const home=add(base(),rect(300,200,400,100)),anchor=home.sections[0],extension=home.sections[1];
  const moved=moveSelection(home,{...emptySelection(),sections:[extension.id]},{x:-250,y:0});
  assert.deepEqual(moved.sections.find(s=>s.id===anchor.id).points,anchor.points);
  const result=moved.sections.find(s=>s.id===extension.id),joins=moved.walls.filter(w=>w.source==='join');
  assert.equal(outlineBounds(result.points).x,50);assert.equal(outlineBounds(result.points).width,400);
  assert.ok(joins.some(w=>w.points.every(p=>p.x===300)));
  assert.ok(joins.every(w=>w.points.every(p=>p.x===100)||w.points.every(p=>p.x===300)));
  assert.deepEqual(normalizePlan(moved),moved);
});

test('the stationary side owns the divider even when the moved room was created first',()=>{
  const home=add(base(),rect(300,150,200,200)),first=home.sections[0],stationary=home.sections[1];
  const moved=moveSelection(home,{...emptySelection(),sections:[first.id]},{x:120,y:0});
  assert.deepEqual(moved.sections.find(s=>s.id===stationary.id).points,stationary.points);
  assert.equal(outlineBounds(moved.sections.find(s=>s.id===first.id).points).width,200);
  assert.ok(moved.walls.filter(w=>w.source==='join').every(w=>w.points.every(p=>p.x===300)));
});

test('a connected section can pass entirely across a base without clamping or shrinking',()=>{
  const home=add(base(),rect(300,200,400,100)),id=home.sections[1].id;
  const moved=moveSelection(home,{...emptySelection(),sections:[id]},{x:-650,y:0});
  const bounds=outlineBounds(moved.sections.find(s=>s.id===id).points);
  assert.equal(bounds.x,-350);assert.equal(bounds.width,400);
  assert.equal(moved.walls.filter(w=>w.source==='join').length,0);assert.equal(moved.outlines.length,2);
});

test('a section remains movable when completely contained by another base',()=>{
  const home=add(base(),rect(300,200,100,100)),id=home.sections[1].id;
  const moved=moveSelection(home,{...emptySelection(),sections:[id]},{x:-150,y:0});
  assert.deepEqual(outlineBounds(moved.sections.find(s=>s.id===id).points),{x:150,y:200,width:100,height:100});
  assert.equal(moved.walls.filter(w=>w.source==='join').length,0);
  const onward=moveSelection(moved,{...emptySelection(),sections:[id]},{x:-250,y:0});
  assert.equal(outlineBounds(onward.sections.find(s=>s.id===id).points).x,-100);
});

test('one continuous drag can connect on either side and then detach freely',()=>{
  const home=add(base(),rect(500,200,200,100)),id=home.sections[1].id,s={...emptySelection(),sections:[id]};
  const right=moveSelection(home,s,{x:-190,y:0});
  assert.ok(right.walls.filter(w=>w.source==='join').some(w=>w.points.every(p=>p.x===300)));
  const left=moveSelection(home,s,{x:-500,y:0});
  assert.ok(left.walls.filter(w=>w.source==='join').some(w=>w.points.every(p=>p.x===100)));
  const farther=moveSelection(home,s,{x:-750,y:0});
  assert.equal(outlineBounds(farther.sections.find(section=>section.id===id).points).x,-250);
  assert.equal(farther.walls.filter(w=>w.source==='join').length,0);
});
test('deleting one section preserves the other and removes its obsolete shared divider',()=>{
  const home=add(base(),rect(300,150,200,200));
  const result=deleteSelection(home,{...emptySelection(),sections:[home.sections[1].id]});
  assert.equal(result.sections.length,1);assert.equal(result.outlines.length,1);assert.equal(result.walls.filter(w=>w.source==='join').length,0);
  assert.equal(planArea(result.boundary),16);
});
test('deleting the last section leaves a completely empty floor plan',()=>{
  const home=base(),result=normalizePlan(deleteSelection(home,{...emptySelection(),sections:[home.sections[0].id]}));
  assert.equal(result.sections.length,0);assert.equal(result.boundary.length,0);assert.equal(result.outlines.length,0);
});
test('deleting the shared divider opens the rooms and is retained across subsequent edits',()=>{
  const home=add(base(),rect(300,150,200,200)),join=home.walls.find(w=>w.source==='join');
  const result=normalizePlan(deleteSelection(home,{...emptySelection(),walls:[join.id]}));
  assert.equal(result.sections.length,2);assert.equal(result.walls.length,0);assert.equal(normalizePlan(result).walls.length,0);
});
test('ordinary horizontal corner drag changes width without changing height',()=>{
  const home=base(),id=home.sections[0].id;
  const result=resizeOutline(home,0,{x:0,y:150},{sectionId:id});
  const b=outlineBounds(result.sections[0].points);
  assert.equal(b.width,300);assert.equal(b.height,200);assert.equal(b.x+b.width,300);assert.equal(b.y+b.height,350);
  assert.equal(result.sections[0].points.length,4);
});
test('ordinary vertical corner drag changes height without changing width',()=>{
  const home=base(),result=resizeOutline(home,0,{x:100,y:50},{sectionId:home.sections[0].id});
  const b=outlineBounds(result.sections[0].points);assert.equal(b.width,200);assert.equal(b.height,300);
  assert.equal(new Set(result.sections[0].points.map(p=>p.x)).size,2);assert.equal(new Set(result.sections[0].points.map(p=>p.y)).size,2);
});
test('proportional resizing remains an explicit option',()=>{
  const home=base(),result=resizeOutline(home,0,{x:0,y:150},{sectionId:home.sections[0].id,proportional:true});
  const b=outlineBounds(result.sections[0].points);assert.equal(b.width,300);assert.equal(b.height,300);
});

test('round sections have four controls on the curve and a top drag changes height only',()=>{
  const points=Array.from({length:64},(_,i)=>({x:400+100*Math.cos(i/64*Math.PI*2),y:350+100*Math.sin(i/64*Math.PI*2)}));
  const home=add(initialHome(),points,'ellipse'),id=home.sections[0].id;
  const controls=outlineControls(points,'ellipse');assert.equal(controls.length,4);
  for(const p of controls)assert.ok(Math.abs(Math.hypot(p.x-400,p.y-350)-100)<.001);
  const result=resizeOutline(home,0,{x:400,y:200},{sectionId:id,control:controls[0]}),b=outlineBounds(result.sections[0].points);
  assert.equal(b.width,200);assert.equal(b.height,250);assert.equal(result.sections[0].points.length,64);
  const cx=b.x+b.width/2,cy=b.y+b.height/2;
  for(const p of result.sections[0].points)assert.ok(Math.abs(((p.x-cx)/(b.width/2))**2+((p.y-cy)/(b.height/2))**2-1)<.001);
});

test('polygon resize controls sit on vertices and preserve height during horizontal resizing',()=>{
  const points=[{x:100,y:150},{x:280,y:110},{x:360,y:200},{x:290,y:350},{x:140,y:320}];
  const home=add(initialHome(),points,'polygon'),id=home.sections[0].id,controls=outlineControls(points,'polygon');
  assert.equal(controls.length,points.length);
  for(const p of controls)assert.deepEqual({x:p.x,y:p.y},points[p.index]);
  const result=resizeOutline(home,0,{x:60,y:150},{sectionId:id,control:controls[0]}),b=outlineBounds(result.sections[0].points);
  assert.equal(b.x,60);assert.equal(b.width,300);assert.equal(b.height,240);
});

test('freehand controls stay on the actual contour with a manageable number of handles',()=>{
  const points=Array.from({length:180},(_,i)=>{const r=100+15*Math.cos(i*.2);return{x:400+r*Math.cos(i/180*Math.PI*2),y:350+r*Math.sin(i/180*Math.PI*2)};});
  const controls=outlineControls(points,'freeform');assert.ok(controls.length<=36);
  for(const p of controls)assert.deepEqual({x:p.x,y:p.y},points[p.index]);
  assert.ok(outlineControls(points,'freeform','points').every(p=>p.kind==='vertex'));
  const almostRound=Array.from({length:64},(_,i)=>({x:400+100*Math.cos(i/64*Math.PI*2),y:350+100*Math.sin(i/64*Math.PI*2)}));
  assert.ok(outlineControls(almostRound,'freeform').length>4,'hand-drawn contours must not be silently treated as ellipse primitives');
});

test('point editing exposes real vertices on rectangles, polygons and ellipses',()=>{
  const ellipse=Array.from({length:64},(_,i)=>({x:400+100*Math.cos(i/64*Math.PI*2),y:350+100*Math.sin(i/64*Math.PI*2)}));
  for(const [type,points] of [['rectangle',rect(100,150,200,200)],['polygon',[{x:100,y:100},{x:300,y:130},{x:260,y:350},{x:120,y:300}]],['ellipse',ellipse]]){
    const home=add(initialHome(),points,type),id=home.sections[0].id,controls=outlineControls(points,type,'points');
    assert.ok(controls.length>=4);
    assert.ok(controls.every(p=>p.kind==='vertex'));
    for(const control of controls)assert.deepEqual({x:control.x,y:control.y},points[control.index]);
    const control=controls[0],target={x:control.x-40,y:control.y-30};
    const moved=moveVertex(home,`section:${id}`,control.index,target).sections.find(s=>s.id===id).points;
    assert.deepEqual(moved[control.index],target);
    points.forEach((p,i)=>{if(i!==control.index)assert.deepEqual(moved[i],p);});
  }
});

test('selection-box resizing scales selected sections together without morphing their contours',()=>{
  const home=add(base(),rect(300,150,100,200)),ids=home.sections.map(s=>s.id);
  const result=resizeOutline(home,0,{x:0,y:100},{sectionIds:ids});
  const before=outlineBounds(home.sections.flatMap(s=>s.points)),after=outlineBounds(result.sections.flatMap(s=>s.points));
  assert.deepEqual(after,{x:0,y:100,width:400,height:250});
  for(const section of home.sections){
    const points=result.sections.find(s=>s.id===section.id).points;
    section.points.forEach((p,i)=>{
      assert.ok(Math.abs(points[i].x-(400+(p.x-400)*after.width/before.width))<.001);
      assert.ok(Math.abs(points[i].y-(350+(p.y-350)*after.height/before.height))<.001);
    });
  }
});

test('floor sides use axis resize cursors and resize without morphing vertices',()=>{
  const home=base(),section=home.sections[0],edges=outlineEdgeControls(section.points);
  assert.deepEqual(edges.map(e=>e.cursor),['ns-resize','ew-resize','ns-resize','ew-resize']);
  const right=edges[1],wider=resizeOutline(home,right.index,{x:right.control.x+80,y:right.control.y},{sectionId:section.id,control:right.control});
  assert.deepEqual(outlineBounds(wider.sections[0].points),{x:100,y:150,width:280,height:200});
  assert.equal(new Set(wider.sections[0].points.map(p=>p.x)).size,2);
  const top=edges[0],taller=resizeOutline(home,top.index,{x:top.control.x,y:top.control.y-60},{sectionId:section.id,control:top.control});
  assert.deepEqual(outlineBounds(taller.sections[0].points),{x:100,y:90,width:200,height:260});
});
