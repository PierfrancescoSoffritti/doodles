import test from 'node:test';
import assert from 'node:assert/strict';
import {HeightSampleCache} from '../../js/world/HeightSampleCache.js?v=stable-30-3';
const fields=['_water','_bank','_foam','_riverDist','_riverWidth','_riverAlong','_riverAcross','_riverSeg','_slope','_hardness'];
function fixture(){let calls=0;const hm={waterLevel:0,lakes:{},sample(x,z){calls++;fields.forEach((key,i)=>this[key]=x+z*i+this.waterLevel);this.lakes.shoreId=Math.floor(x);this.lakes.shoreDistance=z;return x-z+this.waterLevel;}};return{hm,calls:()=>calls};}
const snapshot=hm=>[...fields.map(k=>hm[k]),hm.lakes.shoreId,hm.lakes.shoreDistance];
test('cache restores all terrain and lake scratch values after intervening queries',()=>{
 const {hm,calls}=fixture(),cache=new HeightSampleCache(hm);cache.reset();
 const result=hm.sample(2.25,3.75),expected=snapshot(hm);hm.sample(11.1,-3.3);assert.equal(hm.sample(2.25,3.75),result);assert.deepEqual(snapshot(hm),expected);assert.equal(calls(),2);assert.equal(cache.hits,1);
 cache.reset();hm.sample(2.25,3.75);assert.equal(calls(),3);hm.waterLevel=8;assert.equal(hm.sample(2.25,3.75),6.5);assert.equal(calls(),4);
 cache.dispose();hm.sample(2.25,3.75);assert.equal(calls(),5);
});
test('hash collisions and signed zero never substitute a different terrain coordinate',()=>{
 const {hm,calls}=fixture(),cache=new HeightSampleCache(hm,1);
 hm.sample(2,3);hm.sample(3,2);assert.equal(hm.sample(2,3),-1);assert.equal(calls(),3);
 hm.sample(0,0);hm.sample(-0,0);assert.equal(calls(),5);assert.equal(hm.sample(-0,0),0);assert.ok(Object.is(cache.data[0],-0));assert.equal(calls(),5);
 cache.dispose();
});

test('real lake, river and open terrain samples retain every output exactly',async()=>{
 globalThis.location={search:'?seed=umbra'};
 const [{generateWorld},{Heightmap}]=await Promise.all([import('../../js/world/gen/WorldGen.js'),import('../../js/world/Heightmap.js?v=stable-30-6')]);
 const world=generateWorld('umbra',null,{res:256}),hm=new Heightmap('umbra',world),cache=new HeightSampleCache(hm);
 const points=Array.from({length:80},(_,i)=>[(i%10-5)*87.3,(Math.floor(i/10)-4)*63.9]);
 for(const river of world.rivers.slice(0,10))points.push([river.data[0],river.data[1]]);
 for(const [x,z]of points){
  cache.reset();const expected=cache.original.call(hm,x,z),side=snapshot(hm);
  assert.equal(hm.sample(x,z),expected);const misses=cache.misses;
  hm.sample(x+.123,z+.456);assert.equal(hm.sample(x,z),expected);assert.deepEqual(snapshot(hm),side);assert.equal(cache.misses,misses+1);
 }
});

test('cached grid slopes preserve full terrain samples across collisions exactly',async()=>{
 globalThis.location={search:'?seed=umbra'};
 const [{generateWorld},{Heightmap}]=await Promise.all([import('../../js/world/gen/WorldGen.js'),import('../../js/world/Heightmap.js?v=stable-30-6')]);
 const hm=new Heightmap('umbra',generateWorld('umbra',null,{res:256}));
 const cached=hm.gridSlope;
 const direct=function(k){const g=this.grid,N=this.N;return Math.hypot(g[k+1]-g[k-1],g[k+N]-g[k-N])/(2*this.cell);};
 for(let i=0;i<4096;i++){
  const x=((i*7919)%12001)-6000,z=((i*3571)%12001)-6000;
  hm.gridSlope=direct;const expected=hm.sample(x,z),side=snapshot(hm);
  hm.gridSlope=cached;assert.equal(hm.sample(x,z),expected);assert.deepEqual(snapshot(hm),side);
 }
 for(let k=257;k<8190;k+=17){
  assert.equal(cached.call(hm,k),direct.call(hm,k));
  assert.equal(cached.call(hm,k+8192),direct.call(hm,k+8192));
  assert.equal(cached.call(hm,k),direct.call(hm,k));
 }
 assert.equal(hm.slopeKeys.byteLength+hm.slopeValues.byteLength,98304);
});
