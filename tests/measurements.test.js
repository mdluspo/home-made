import test from 'node:test';
import assert from 'node:assert/strict';
import {initialHome,normalizePlan,rectangleFromPoints} from '../src/model.js';
import {outlineBounds,setPlanMeasurement} from '../src/editor.js';

const rect=(x,y,w,h)=>rectangleFromPoints({x,y},{x:x+w,y:y+h});
const base=()=>normalizePlan({...initialHome(),sections:[{id:'base',type:'rectangle',level:1,points:rect(100,100,400,300)}]});
const measurement=(a,b)=>({kind:'outline',sectionIds:['base'],a,b});

test('typed horizontal and vertical measurements resize only their own axis',()=>{
  const home=base(),horizontal=setPlanMeasurement(home,measurement({x:100,y:100},{x:500,y:100}),6);
  assert.equal(horizontal.error,null);
  assert.deepEqual(outlineBounds(horizontal.home.sections[0].points),{x:100,y:100,width:300,height:300});
  const vertical=setPlanMeasurement(home,measurement({x:500,y:100},{x:500,y:400}),4);
  assert.equal(vertical.error,null);
  assert.deepEqual(outlineBounds(vertical.home.sections[0].points),{x:100,y:100,width:400,height:200});
  assert.deepEqual(home.sections[0].points,rect(100,100,400,300));
});

test('typed diagonal measurements scale proportionally rather than morphing one corner',()=>{
  const points=[{x:100,y:100},{x:500,y:100},{x:350,y:400},{x:100,y:400}];
  const home=normalizePlan({...initialHome(),sections:[{id:'base',type:'polygon',level:1,points}]}),a=points[1],b=points[2];
  const result=setPlanMeasurement(home,measurement(a,b),Math.hypot(b.x-a.x,b.y-a.y)*2/50);
  assert.equal(result.error,null);
  points.forEach((p,i)=>{
    const next=result.home.sections[0].points[i];
    assert.ok(Math.abs(next.x-(a.x+(p.x-a.x)*2))<.001);assert.ok(Math.abs(next.y-(a.y+(p.y-a.y)*2))<.001);
  });
});

test('ellipse width can be entered exactly while its height stays unchanged',()=>{
  const points=Array.from({length:64},(_,i)=>({x:400+100*Math.cos(i/64*Math.PI*2),y:350+70*Math.sin(i/64*Math.PI*2)}));
  const home=normalizePlan({...initialHome(),sections:[{id:'base',type:'ellipse',level:1,points}]});
  const result=setPlanMeasurement(home,measurement({x:300,y:280},{x:500,y:280}),6);
  assert.equal(result.error,null);
  assert.deepEqual(outlineBounds(result.home.sections[0].points),{x:300,y:280,width:300,height:140});
});

test('invalid sizes and sizes that would merge another floor are rejected without changes',()=>{
  const home=base(),dimension=measurement({x:100,y:100},{x:500,y:100});
  for(const value of [0,-1,NaN,Infinity,1e308,.01]){
    const result=setPlanMeasurement(home,dimension,value);assert.ok(result.error);assert.equal(result.home,home);
  }
  const two=normalizePlan({...home,sections:[...home.sections,{id:'upper',level:2,points:rect(700,100,200,300)}]});
  const result=setPlanMeasurement(two,dimension,14);
  assert.match(result.error,/overlap/);assert.equal(result.home,two);
});

test('typed wall lengths carry wall openings and reject clipping at the floor boundary',()=>{
  const home=normalizePlan({...initialHome(),sections:[{id:'base',type:'rectangle',level:1,points:rect(100,100,700,500)}],walls:[{id:'wall',points:[{x:300,y:200},{x:600,y:200}]}],openings:[{id:'door',type:'door',x:450,y:200,angle:0}]});
  const dimension={kind:'wall',wallId:'wall',a:{x:300,y:200},b:{x:600,y:200}},result=setPlanMeasurement(home,dimension,4);
  assert.equal(result.error,null);assert.deepEqual(result.home.walls.find(w=>w.id==='wall').points,[{x:300,y:200},{x:500,y:200}]);
  assert.equal(result.home.openings[0].x,400);
  const tooLong=setPlanMeasurement(home,dimension,100);assert.ok(tooLong.error);assert.equal(tooLong.home,home);
});
