import assert from 'node:assert/strict';
import { generateWorld } from '../js/world/gen/WorldGen.js';
import { lumenLakes } from '../js/world/fauna/LumenSchool.js';
import { reedSites } from '../js/world/fauna/ReedWalkerHabitat.js';
import { ReedWalkerWorldModel } from '../js/world/fauna/ReedWalkerWorldModel.js';
import { reedJoint } from '../js/world/fauna/ReedWalkerMotion.js';
globalThis.location={search:'?seed=umbra'};
const { Heightmap }=await import('../js/world/Heightmap.js');
for(const seed of ['umbra','vesper']) {
 const world=generateWorld(seed,null,{res:seed==='umbra'?1024:256}),hm=new Heightmap(seed,world);
 const sample=(x,z)=>{const ground=hm.sample(x,z),water=hm._water,slope=hm._slope,foam=hm._foam;return{ground,water,slope,foam,roof:false};};
 const sites=reedSites(world,lumenLakes(world,sample)),model=new ReedWalkerWorldModel(seed,sites,sample);
 const group=seed==='umbra'?model.add(sites.find(s=>s.id==='river:1:158:-1')):model.findFamily({x:0,z:0});assert.ok(group,`${seed}: a suitable family habitat exists`);
 for(let frame=0;frame<30*1200;frame++) {
  model.update(1/30,{x:group.site.x+60,z:group.site.z+60});
  for(const m of group.members) {
   const p=m.draw.pose;
   for(let i=0;i<4;i++) {
    const fore=i<2?1:-1,side=i%2?1:-1,x=fore*m.traits.length*.65;
    const hip=[p.body[0]+x*Math.cos(p.tilt),p.body[1]+x*Math.sin(p.tilt),p.body[2]+side*m.traits.width*.64];
    assert.ok(reedJoint(hip,p.feet[i],m.traits.legs*.61,side,fore).every(Number.isFinite),`${seed}: supported leg`);
   }
  }
 }
 console.log(JSON.stringify({seed,sites:sites.length,family:group.id,members:group.members.length,steps:group.members.map(m=>m.steps)}));
}
