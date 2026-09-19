import test from 'node:test';
import assert from 'node:assert/strict';
import { landscapeContext,valleyView } from '../../js/world/structures/LandscapeSite.js';
import { mountainApproach,rotateApproach,approachFloor } from '../../js/world/structures/MountainSteps.js';
test('gate and fold need meaningful surroundings, not just flat ground',()=>{
 const flat={height:()=>20,sample:()=>20,_water:0};
 assert.equal(landscapeContext(flat,'resonant-gate',0,0,20,0),null);
 assert.equal(landscapeContext(flat,'listening-fold',0,0,20,0),null);
 const shore={height:(x,z)=>z< -100?0:z>100?40:20,sample(x,z){return this.height(x,z);},_water:2};
 assert.equal(landscapeContext(shore,'resonant-gate',0,0,20,0).setting,'shore threshold');
 assert.equal(landscapeContext(shore,'listening-fold',0,0,20,0).setting,'sheltered waterside');
 const wood={...flat,habitat:(x,z)=>({forest:z>0?.8:.05})};
 assert.equal(landscapeContext(wood,'listening-fold',0,0,20,0).setting,'woodland edge');
});
test('the frame rejects a high plateau and an obstructed valley',()=>{
 const height=(x,z)=>Math.max(30,600-.4*Math.hypot(x,z)+140*(1-Math.exp(-x*x/(180*180)))*Math.exp(-(((z+650)/400)**2)));
 const hm={height,sample:height,_water:0};const view=valleyView(hm,0,0,600,0);assert.ok(view&&view.drop>=220&&view.nearDrop>=55);
 assert.equal(valleyView({...hm,height:()=>600,sample:()=>600},0,0,600,0),null);
 assert.equal(valleyView({...hm,height:(x,z)=>z< -220&&z> -280?650:height(x,z)},0,0,600,0),null);
 assert.equal(valleyView({...hm,_water:600},0,0,600,0),null,'a sea basin is not a land valley');
});
test('rotating the approach preserves its physical walking surface',()=>{
 const trail=mountainApproach((x,z)=>600-.3*Math.hypot(x,z));assert.ok(trail);
 const angle=1.9,c=Math.cos(angle),s=Math.sin(angle),turned=rotateApproach(trail,angle);
 for(const p of trail.route){const x=c*p.x+s*p.z,z=-s*p.x+c*p.z;assert.equal(approachFloor(turned,x,z),approachFloor(trail,p.x,p.z));}
 assert.ok(Math.abs(turned.arrivalX)>100);assert.ok(Math.abs(Math.hypot(turned.arrivalX,turned.arrivalZ)-155)<1e-9);
});

test('a trail from another flank turns into the opening without crossing its supports',async()=>{
 const {StructureStudy}=await import('../../js/atelier/StructureStudy.js');const frame=new StructureStudy({kind:'horizon-frame'});
 for(const heading of [Math.PI/4,-Math.PI/2,Math.PI*.75]){
  const trail=mountainApproach((x,z)=>600-.12*Math.hypot(x,z),'turn-check',heading);assert.ok(trail);
  for(const p of trail.route)assert.equal(frame.blocked(p.x,p.z),false,'the path cannot end inside a stone support');
 }
});
