import test from 'node:test';
import assert from 'node:assert/strict';
import {hypot2,hypot3} from '../../js/core/NumericDistance.js?v=stable-30-6';

test('numeric distances retain native results across finite scales and special values',()=>{
 const special=[0,-0,NaN,Infinity,-Infinity,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,1e-300,1e300,3,-4,11.7];
 for(const x of special)for(const y of special){
  assert.ok(Object.is(hypot2(x,y),Math.hypot(x,y)));
  for(const z of special)assert.ok(Object.is(hypot3(x,y,z),Math.hypot(x,y,z)));
 }
 let state=751;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)|0;return(state>>>0)/4294967296;};
 for(let i=0;i<100000;i++) {
  const x=(random()-.5)*10**(random()*600-300),y=(random()-.5)*10**(random()*600-300),z=(random()-.5)*10**(random()*600-300);
  assert.ok(Object.is(hypot2(x,y),Math.hypot(x,y)));
  assert.ok(Object.is(hypot3(x,y,z),Math.hypot(x,y,z)));
 }
});
