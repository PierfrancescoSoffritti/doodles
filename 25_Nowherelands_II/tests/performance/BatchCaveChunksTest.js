import test from 'node:test';
import assert from 'node:assert/strict';
import { batchCaveChunks } from '../../js/world/caves/BatchCaveChunks.js?v=stable-30-24';
const triangle = (cave, x, indexed = true) => ({ cave, position: Float32Array.of(x, 0, 0, x+1, 0, 0, x, 1, 0), ...(indexed ? {index:Uint16Array.of(0,2,1)} : {}) });
function expanded(chunks) {
 const out=[];
 for(const c of chunks) {
  const words=new Uint32Array(c.position.buffer,c.position.byteOffset,c.position.length);
  for(let i=0;i<(c.index?.length??words.length/3);i++) {
   const k=(c.index?c.index[i]:i)*3;
   out.push(c.cave,words[k],words[k+1],words[k+2]);
  }
 }
 return out;
}
test('cave batching retains every triangle word, winding and cave boundary',()=>{
 const chunks=Array.from({length:500},(_,i)=>triangle(i<250?0:1,(i%100)*.2,i%3!==0));
 const combined=batchCaveChunks(chunks,300);
 assert.deepEqual(expanded(combined),expanded(chunks));
 assert.ok(combined.length<chunks.length/20);
 assert.ok(combined.every(c=>c.position.length/3<=300));
});
test('distant chunks remain separately culled',()=>{
 const a=triangle(0,0),b=triangle(0,200),c=triangle(0,201);
 const out=batchCaveChunks([a,b,c]);
 assert.equal(out.length,2);assert.equal(out[0],a);
 assert.deepEqual(expanded(out),expanded([a,b,c]));
});
test('an existing large chunk cannot overflow a batch index',()=>{
 const large={cave:0,position:new Float32Array(65536*3),index:Uint32Array.of(0,1,65535)};
 const small=triangle(0,0),out=batchCaveChunks([large,small],100000);
 assert.equal(out.length,2);assert.equal(out[0],large);assert.equal(out[1],small);
 assert.deepEqual(batchCaveChunks([]),[]);
});
