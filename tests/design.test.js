import test from 'node:test';
import assert from 'node:assert/strict';
import {initialHome,normalizePlan,rectangleFromPoints,validateHome} from '../src/model.js';
import {designRooms,applyRoomStyle,setRoomDecor,roomSetting,ambienceAt,materialColor,roomWallPaint} from '../src/design.js';
import {floorDescriptors,floorHome} from '../src/floors.js';
import {moveSelection,emptySelection} from '../src/editor.js';
import {buildRoomWalls} from '../src/roomWalls.js';

const makeHome=()=>normalizePlan({...initialHome(),boundary:rectangleFromPoints({x:100,y:100},{x:700,y:500}),walls:[{id:'divider',points:[{x:400,y:100},{x:400,y:500}]}],items:[{id:'sofa',type:'sofa',x:220,y:250,scale:1,rotation:0},{id:'locked',type:'chair',x:250,y:300,scale:1,rotation:0,locked:true},{id:'other-room',type:'bed',x:550,y:300,scale:1,rotation:0}]});

test('room presets affect only the chosen space and keep locked furniture and geometry intact',()=>{
  const home=makeHome(),floor=floorHome(home,floorDescriptors(home)[0]),rooms=designRooms(floor),left=rooms.find(r=>r.x<400);
  assert.equal(rooms.length,2);
  const styled=applyRoomStyle(home,'vintage',1,left);
  assert.equal(styled.items[0].finish.wood,'walnut');
  assert.equal(styled.items[1].finish,undefined);
  assert.equal(styled.items[2].finish,undefined);
  assert.equal(roomSetting(styled,left,1).style,'vintage');
  assert.deepEqual(styled.walls,home.walls);assert.deepEqual(styled.boundary,home.boundary);
  assert.equal(validateHome(styled),true);
  const paints=roomWallPaint(floorHome(styled,floorDescriptors(styled)[0]),buildRoomWalls(floor),rooms);
  assert.ok(paints.some(p=>p.color==='#e8d6c9'),'the room palette also paints its visible walls');
});

test('level palettes persist through floor extraction and room names travel with floor moves',()=>{
  let home=applyRoomStyle(makeHome(),'coastal',1);
  const floor=floorHome(home,floorDescriptors(home)[0]),room=designRooms(floor)[0];
  assert.equal(floor.floor,'birch');assert.equal(floor.wallColor,'#d7dfdc');
  home=setRoomDecor(home,room,1,{name:'Reading nook',showLabel:true});
  const record=home.roomDecor[0];
  const moved=moveSelection(home,{...emptySelection(),boundary:true},{x:90,y:30});
  assert.equal(moved.roomDecor[0].x,record.x+90);assert.equal(moved.roomDecor[0].y,record.y+30);
  assert.equal(moved.roomDecor[0].name,'Reading nook');assert.equal(validateHome(moved),true);
});

test('legacy homes remain valid and new design values are bounded before saving',()=>{
  const home=makeHome();assert.equal(validateHome(home),true);
  const designed={...home,ambience:{hour:23,lights:true},items:home.items.map(i=>({...i,finish:{wood:'birch',fabric:'blue'},lit:false}))};
  assert.equal(validateHome(designed),true);
  assert.equal(validateHome({...designed,ambience:{hour:25,lights:true}}),false);
  assert.equal(validateHome({...designed,items:[{...home.items[0],finish:{wood:'invalid'}}]}),false);
  assert.equal(ambienceAt(14).darkness,0);assert.ok(ambienceAt(23).darkness>.4);
  assert.match(materialColor('#c4a274','#8c6952'),/^#[a-f\d]{6}$/i);
});
