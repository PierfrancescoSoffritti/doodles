import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FaunaSurfaceCache} from '../../js/world/fauna/FaunaSurfaceCache.js?v=stable-30-5';

const side = h => [h._water,h._bank,h._foam,h._riverDist,h._riverWidth,
 h._riverAlong,h._riverAcross,h._riverSeg,h._slope,h._hardness,
 h.lakes.shoreId,h.lakes.shoreDistance,{...h._hab}];

test('fauna cache preserves actual surface records and scratch fields across collisions and water changes', async () => {
 globalThis.location = {search: '?seed=umbra'};
 const [{generateWorld},{Heightmap}] = await Promise.all([
  import('../../js/world/gen/WorldGen.js'),import('../../js/world/Heightmap.js?v=stable-30-6')]);
 const hm = new Heightmap('umbra',generateWorld('umbra',null,{res:256}));
 // Use the production classifier as the oracle, including cave/habitat queries.
 const source = readFileSync(new URL('../../js/world/fauna/Fauna.js?v=stable-30-25',import.meta.url),'utf8');
 const body = source.split('this.sample = (x, z, clearanceOnly = false) => {')[1].split('\n\t\t};')[0];
 const original = new Function('heightmap', 'return (x,z,clearanceOnly=false)=>{' + body + '}')(hm);
 const cache = new FaunaSurfaceCache(hm,original,32);
 for (let i=0;i<4096;i++) {
  const x=((i*7919)%12001)-6000,z=((i*3571)%12001)-6000;
  const expected=original(x,z),scratch=side(hm),actual=cache.sample(x,z);
  assert.deepEqual(actual,expected);
  original(x+.125,z+.375);
  assert.equal(cache.sample(x,z),actual);assert.deepEqual(side(hm),scratch);
 }
 const expected=original(1.25,2.75),retained=cache.sample(1.25,2.75);
 assert.ok(Object.isFrozen(retained));
 for(let i=0;i<4096;i++)cache.sample(i/7,-i/11);
 assert.deepEqual(retained,expected);
 const habitat={...hm._hab};
 assert.deepEqual(cache.sample(1.25,2.75,true),original(1.25,2.75,true));
 assert.deepEqual(hm._hab,habitat);
 hm.waterLevel=120;assert.deepEqual(cache.sample(1.25,2.75),original(1.25,2.75));
 assert.equal(cache.sample(1.25,2.75).water,120);
 assert.equal(cache.records.length,32);
});

test('signed-zero coordinates do not alias, and retained records cannot be corrupted by consumers', () => {
 const hm={waterLevel:0,lakes:{shoreId:-1,shoreDistance:Infinity},_hab:{forest:0,wet:0,coast:0,alt:1}};
 for(const key of ['_water','_bank','_foam','_riverDist','_riverWidth','_riverAlong','_riverAcross','_riverSeg','_slope','_hardness'])hm[key]=0;
 const cache=new FaunaSurfaceCache(hm,(x,z)=>({ground:x,water:z}),1);
 const first=cache.sample(0,0),second=cache.sample(-0,0);
 assert.notEqual(first,second);assert.ok(Object.is(second.ground,-0));
 assert.throws(()=>{second.ground=3;},TypeError);
 assert.equal(cache.sample(-0,0),second);
});
