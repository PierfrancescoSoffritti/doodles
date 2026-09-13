import test from 'node:test';
import assert from 'node:assert/strict';
import {packWords,unpackWords} from '../../js/world/StaticWords.js?v=stable-30-21';
import {compactStaticWater} from '../../js/world/StaticWaterCopy.js?v=stable-30-21';

test('cold attribute copies preserve arbitrary float bits, strides, long runs and empty arrays',()=>{
 let state=1234;const random=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
 for(const length of[0,1,2,7,128,40000])for(const stride of[1,2,3,4])for(const mode of['zeros','random','runs']){
  const words=new Uint32Array(length);for(let i=0;i<length;i++)words[i]=mode==='zeros'?0:mode==='runs'?Math.floor(i/171)*729:random();
  const array=new Float32Array(words.buffer),copy=unpackWords(packWords(array,stride),array.length,stride,Float32Array);
  assert.deepEqual(new Uint32Array(copy.buffer),words);
 }
});

test('static water avoids first-upload decompression and restores exact data for a context rebuild',async()=>{
 const original=Float32Array.from({length:30000},(_,i)=>Math.floor(i/40)/7),bits=new Uint32Array(original.buffer);
 const attribute={array:original,itemSize:3,onUploadCallback(){this.uploads=(this.uploads||0)+1}};
 const root={traverse(fn){fn({geometry:{attributes:{position:attribute}}})}};
 const stats=compactStaticWater([root,root]);
 assert.equal(stats.attributes,1);assert.equal(attribute.array,original);assert.equal(stats.decoded,0);
 attribute.onUploadCallback();assert.equal(stats.raw,0);assert.equal(attribute.uploads,1);stats.finishWarmup();
 const read=attribute.array;
 assert.notEqual(read,original);assert.deepEqual(new Uint32Array(read.buffer),bits);assert.equal(attribute.array,read);assert.equal(stats.decoded,1);
 await Promise.resolve();assert.equal(stats.raw,0);
 const restored=attribute.array;assert.deepEqual(new Uint32Array(restored.buffer),bits);
 attribute.onUploadCallback();assert.equal(stats.raw,0);assert.equal(stats.decoded,2);
});

test('a buffer absent from the first view retains only its ordinary writable CPU copy',()=>{
 const array=new Float32Array(30000),upload=()=>{},attribute={array,itemSize:3,onUploadCallback:upload};
 const stats=compactStaticWater([{traverse(fn){fn({geometry:{attributes:{position:attribute}}})}}]);
 assert.equal(stats.attributes,1);stats.finishWarmup();stats.finishWarmup();
 assert.equal(attribute.array,array);assert.equal(attribute.onUploadCallback,upload);
 assert.equal(stats.attributes,0);assert.equal(stats.after,array.byteLength);assert.equal(stats.raw,0);
 assert.equal(Object.getOwnPropertyDescriptor(attribute,'array').writable,true);
});
