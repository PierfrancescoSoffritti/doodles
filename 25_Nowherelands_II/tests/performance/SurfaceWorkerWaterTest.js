import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld } from '../../js/world/gen/WorldGen.js';
import { WaterMeshData } from '../../js/world/WaterMeshData.js?v=stable-30-23';
import { terrainMeshData } from '../../js/world/TerrainMeshData.js?v=stable-30-23';

test('shared surface worker transfers unchanged water geometry between terrain jobs', async () => {
 const previous=globalThis.self, replies=[];
 globalThis.location={search:'?seed=umbra'};
 const {Heightmap}=await import('../../js/world/Heightmap.js?v=stable-30-6');
 globalThis.self={postMessage:(message,transfer=[])=>replies.push(structuredClone(message,{transfer}))};
 try {
  await import('../../js/world/SurfaceWorker.js?v=stable-30-25');
  const world=generateWorld('umbra',null,{res:128}), expectedHeight=new Heightmap('umbra',structuredClone(world));
  const expectedWater=new WaterMeshData(expectedHeight);
  self.onmessage({data:{type:'init',seed:'umbra',world:structuredClone(world)}});
  assert.deepEqual(replies.pop(),{type:'ready'});
  const river=world.rivers.find(r=>r.count>10), x=river.data[0], z=river.data[1];
  for(let i=0;i<3;i++) {
   const terrain={type:'terrain',id:i*2,depth:2,ix:i,iz:1};
   self.onmessage({data:terrain});
   assert.deepEqual(replies.pop(),{id:terrain.id,result:terrainMeshData(expectedHeight,2,i,1)});
   self.onmessage({data:{type:'water',id:i*2+1,x:x+i*50,z}});
   const answer=replies.pop();
   assert.equal(answer.id,i*2+1);assert.equal(answer.error,undefined);
   assert.deepEqual(answer.result,expectedWater.buildNear(x+i*50,z));
   assert.ok(answer.result.index.length>0);
  }
 } finally {globalThis.self=previous;}
});
