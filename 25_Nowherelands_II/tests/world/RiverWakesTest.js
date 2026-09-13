import test from 'node:test';
import assert from 'node:assert/strict';
import { writeRiverWakes, riverWakes } from '../../js/world/RiverFlow.js?v=stable-30-10';
function original(river,index,stride,alongField) {
 const a=river.data[index*stride+alongField],b=river.data[(index+1)*stride+alongField],picks=[];
 for(let i=0;i<river.wakes.length;i+=3){const s=river.wakes[i],r=river.wakes[i+2];if(s>b+r*3||s<a-r*10)continue;picks.push([Math.abs(s-(a+b)*.5),[s,river.wakes[i+1],r]]);}
 picks.sort((a,b)=>a[0]-b[0]);return [0,1,2].map(i=>picks[i]?.[1]||[0,0,0]);
}
test('packed river wakes preserve stable selection, double precision, and reusable output',()=>{
 let state=0x12345678;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const out=[[0,0,0],[0,0,0],[0,0,0]];
 let checked=0;
 for(let r=0;r<50;r++){
  const data=new Float64Array(81*5);for(let i=0;i<81;i++)data[i*5+2]=i*13.7;
  const wakes=[];for(let i=0;i<90;i++)wakes.push(random()*1200,random()*10-5,random()*9);
  // Equal distances retain the incoming order, including duplicate positions.
  wakes.push(6.85,1,4,6.85,2,4,6.85,3,4,6.85,4,4);
  const river={data,wakes};
  for(let repeat=0;repeat<2;repeat++)for(let i=0;i<80;i++){
   const expected=original(river,i,5,2);assert.equal(writeRiverWakes(river,i,5,2,out),out);assert.deepEqual(out,expected);assert.deepEqual(riverWakes(river,i,5,2),expected);checked++;
  }
 }
 assert.equal(checked,8000);
 const empty={data:new Float32Array([0,10]),wakes:new Float32Array()};assert.deepEqual(writeRiverWakes(empty,0,1,0,out),[[0,0,0],[0,0,0],[0,0,0]]);
});
