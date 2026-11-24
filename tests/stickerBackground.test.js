import test from 'node:test';
import assert from 'node:assert/strict';
import {removeStickerBackground} from '../src/stickerBackground.js';

const image=(width,height,pixel)=>({width,height,data:Uint8ClampedArray.from(Array.from({length:width*height},(_,n)=>pixel(n%width,Math.floor(n/width))).flat())});
test('multi-colour border removal preserves a distinct central subject and its original pixels',()=>{
  const input=image(30,30,(x,y)=>x>=10&&x<20&&y>=10&&y<20?[190,40,50,255]:x<15?[248,246,237,255]:[190,210,230,255]);
  const original=new Uint8ClampedArray(input.data),result=removeStickerBackground(input);
  assert.equal(result[3],0);assert.equal(result[(29*30+29)*4+3],0);
  assert.deepEqual([...result.slice((15*30+15)*4,(15*30+15)*4+4)],[190,40,50,255]);
  assert.deepEqual(input.data,original);
});
test('an enclosed subject detail matching the background is not flood-erased',()=>{
  const input=image(30,30,(x,y)=>x>=8&&x<22&&y>=8&&y<22?(x>=12&&x<18&&y>=12&&y<18?[255,255,255,255]:[30,70,40,255]):[255,255,255,255]);
  const result=removeStickerBackground(input);
  assert.equal(result[3],0);assert.equal(result[(15*30+15)*4+3],255);
});
test('already-transparent stickers retain existing soft alpha edges',()=>{
  const input=image(20,20,(x,y)=>x>=5&&x<15&&y>=5&&y<15?[180,140,90,160]:[255,255,255,0]);
  assert.deepEqual(removeStickerBackground(input),input.data);
});
