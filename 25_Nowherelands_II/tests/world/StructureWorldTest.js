import test from 'node:test';
import assert from 'node:assert/strict';
import { structureSites,inStructureClearing,worldPoint,localPoint,sweepStructure,roofHeight } from '../../js/world/structures/StructureSites.js';
import { StructureStudy,foldMusic } from '../../js/atelier/StructureStudy.js';

test('structure placement is reproducible, sparse, fully dry and skips invalid terrain',()=>{
 let probes=0;const hm={_water:0,_slope:0,sample(){probes++;return 12;},height(){return 12;},habitat(x){return {forest:(1+Math.tanh(x/180))/2};},caves:{hasOpening(){return false;}}};
 const sites=structureSites(hm,'test');assert.equal(sites.length,2);assert.ok(probes<100000);
 assert.deepEqual(sites,structureSites(hm,'test'));
 for(const s of sites){assert.ok(inStructureClearing(sites,s.x,s.z));assert.equal(inStructureClearing(sites,s.x+10000,s.z),false);assert.ok(s.relief<=3.5);}
 assert.deepEqual(structureSites({...hm,habitat:undefined},'test'),[],'an undifferentiated flat site is not a destination');
 assert.deepEqual(structureSites({...hm,sample(){return -2;}},'test'),[]);
 assert.deepEqual(structureSites({...hm,caves:{hasOpening(){return true;}}},'test'),[]);
});
test('rotated collision preserves the opening and blocks both supports without tunnelling',()=>{
 const s={x:125,z:-310,cos:Math.cos(.73),sin:Math.sin(.73)},bounds=new StructureStudy().bounds;
 for(const x of [0,-22,22]){
  const from=worldPoint(s,x,60,{}),to=worldPoint(s,x,-60,{}),a=localPoint(s,from.x,from.z,{}),b=localPoint(s,to.x,to.z,{});
  const result=sweepStructure(bounds,a.x,a.z,b.x-a.x,b.z-a.z,{});
  if(x===0)assert.ok(result.z<-59);else assert.ok(result.z>5);
  const world=worldPoint(s,result.x,result.z,{}),roundTrip=localPoint(s,world.x,world.z,{});assert.ok(Math.abs(roundTrip.x-result.x)<1e-10);
 }
});
test('fold roof is bounded by its actual profile; shelter and music restore outside',()=>{
 const model=new StructureStudy({kind:'listening-fold'});
 assert.ok(roofHeight(model.parts,0,0)>58);assert.ok(roofHeight(model.parts,49,0)<15);
 assert.ok(roofHeight(model.parts,0,37)<-1e5);assert.ok(roofHeight(model.parts,51,0)<-1e5);
 assert.equal(model.shelterAt({x:0,z:37}),0);
 const mix={};assert.equal(foldMusic(1,mix),mix);assert.ok(mix.arpeggio<.31);foldMusic(0,mix);assert.equal(mix.arpeggio,1);assert.equal(mix.cutoff,1);assert.equal(mix.send,.55);
});

test('frame sightline clears tall growth while retaining low cover and the flanks',()=>{
 const s={x:50,z:-30,cos:Math.cos(.7),sin:Math.sin(.7),extent:170,clearX:43,clearZ:12,view:{}};
 for(const [x,z,expected] of [[0,-80,true],[30,-130,true],[90,-80,false],[0,80,false],[0,-200,false]]){
  const p=worldPoint(s,x,z,{});assert.equal(inStructureClearing([s],p.x,p.z,12),expected);
 }
 const p=worldPoint(s,0,-80,{});assert.equal(inStructureClearing([s],p.x,p.z,2),false);
});
