import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeGateGround,gateGroundChannel,gateExcludesPlant } from '../../js/world/structures/GateGround.js';
import { inStructureClearing,worldPoint } from '../../js/world/structures/StructureSites.js';

test('gate ground is deterministic, bounded and fades before the texture border',()=>{
 const a=bakeGateGround('umbra');assert.equal(a.byteLength,65536);
 assert.deepEqual(a,bakeGateGround('umbra'));assert.notDeepEqual(a,bakeGateGround('fern'));
 for(let i=0;i<128;i++)for(const index of [i,127*128+i,i*128,i*128+127])assert.equal(a[index*4+3],0);
 for(const x of [-23,0,23])assert.ok(gateGroundChannel(a,x,0,0)>.6,'foundations and threshold expose stone');
 assert.equal(gateGroundChannel(a,80,0,0),0);
 assert.ok(gateGroundChannel(a,0,40,3)<.01,'no circular clearing surrounding the gate');
});
test('seeded ground and rotated vegetation agree, with a clear passage and encroaching low growth',()=>{
 const site={kind:'resonant-gate',x:170,z:-380,cos:Math.cos(.73),sin:Math.sin(.73),clearX:43,clearZ:35,extent:Math.hypot(43,35),groundMask:bakeGateGround('umbra')};
 let returning=0,soil=0;
 for(let x=-42;x<=42;x+=2)for(let z=-34;z<=34;z+=2){
  const world=worldPoint(site,x,z,{}),blocked=gateExcludesPlant(site,x,z,3);
  assert.equal(inStructureClearing([site],world.x,world.z,3),blocked);
  if(Math.abs(x)<14&&Math.abs(z)<14)assert.ok(blocked,'passage stays open');
  if(!blocked){returning++;if(gateGroundChannel(site.groundMask,x,z,2)>.15)soil++;}
 }
 assert.ok(returning>400&&soil>10,'vegetation can return to uneven soil margins');
 assert.ok(gateExcludesPlant(site,35,24,12),'large plants remain outside the approach');
 assert.equal(inStructureClearing([site],10000,10000,3),false);
});
