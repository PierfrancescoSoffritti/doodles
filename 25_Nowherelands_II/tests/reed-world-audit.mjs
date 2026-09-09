import assert from 'node:assert/strict';
import { generateWorld } from '../js/world/gen/WorldGen.js';
import { lumenLakes } from '../js/world/fauna/LumenSchool.js';
import { reedSites, reedHabitat, reedShallowFooting } from '../js/world/fauna/ReedWalkerHabitat.js';
import { ReedWalkerWorldModel } from '../js/world/fauna/ReedWalkerWorldModel.js';
import { reedJoint, reedHip } from '../js/world/fauna/ReedWalkerMotion.js';
globalThis.location={search:'?seed=umbra'};
const { Heightmap }=await import('../js/world/Heightmap.js');
for(const seed of ['umbra','vesper']) {
 const world=generateWorld(seed,null,{res:seed==='umbra'?1024:256}),hm=new Heightmap(seed,world);
 const sample=(x,z)=>{const ground=hm.sample(x,z),water=hm._water,slope=hm._slope,foam=hm._foam;return{ground,water,slope,foam,roof:false};};
 const sites=reedSites(world,lumenLakes(world,sample)),model=new ReedWalkerWorldModel(seed,sites,sample);
 const group=model.findFamily({x:0,z:0});assert.ok(group,`${seed}: a suitable family habitat exists`);
 for(let frame=0;frame<30*1200;frame++) {
  model.update(1/30,{x:group.site.x+60,z:group.site.z+60});
  for(const m of group.members) {
   const p=m.draw.pose;
   const at=sample(m.draw.origin.x,m.draw.origin.z);
   assert.ok(reedHabitat(at),`${seed}: shallow margin at frame ${frame}, ${m.role}, ${m.state}: ${JSON.stringify(at)}`);
   for(const foot of m.draw.feet){const support=sample(foot.x,foot.z);assert.ok(reedShallowFooting(support,m.bankWater),`${seed}: shallow footing`);}
   for(let i=0;i<4;i++) {
    const fore=i<2?1:-1,side=i%2?1:-1;
    const hip=reedHip(m.traits,p,i);
    assert.ok(reedJoint(hip,p.feet[i],m.traits.legs*.61,side,fore).every(Number.isFinite),`${seed}: supported leg`);
   }
  }
 }
 console.log(JSON.stringify({seed,sites:sites.length,family:group.id,members:group.members.length,heights:group.members.map(m=>+(m.scale*m.traits.legs).toFixed(2)),steps:group.members.map(m=>m.steps)}));
}
