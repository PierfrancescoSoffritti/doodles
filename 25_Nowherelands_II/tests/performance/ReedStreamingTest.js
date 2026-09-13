import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const T=await import('three'),{WorldReedWalkers}=await import('../../js/world/fauna/WorldReedWalkers.js?v=stable-30-3'),{ReedWalkerRig}=await import('../../js/world/fauna/ReedWalkerRig.js?v=stable-30-3'),{reedIndividual}=await import('../../js/world/fauna/ReedWalkerTraits.js');
function fixture(members){return Object.assign(Object.create(WorldReedWalkers.prototype),{root:new T.Group(),rigs:new Map(),pendingRigs:new Map(),buildBudget:1.5,maxBuildStepMs:0,model:{groups:new Map([['family',{members}]])}});}
test('construction respects its slice budget and publishes a whole family together',t=>{
 let now=0,steps=0;t.mock.method(performance,'now',()=>now);
 const members=[{},{}],world=fixture(members);
 world.buildRig=function*(){for(let i=0;i<3;i++){now+=2;steps++;yield;}return{root:new T.Group()};};
 world.sync();assert.equal(steps,0);assert.equal(world.root.children.length,0);
 world.drainRigs();assert.equal(steps,1);assert.equal(world.root.children.length,0);
 for(let i=0;i<10&&world.pendingRigs.size;i++){world.drainRigs();assert.ok(world.root.children.length===0||world.root.children.length===2);}
 assert.equal(world.rigs.size,2);assert.equal(world.root.children.length,2);assert.equal(steps,6);
});
test('retiring a family cancels and disposes a partially constructed rig',t=>{
 const member={traits:reedIndividual('reedbed',4,'adult','male'),scale:1},world=fixture([member]);
 const dispose=t.mock.method(ReedWalkerRig.prototype,'dispose');
 world.sync();world.pendingRigs.get(member).next();assert.equal(dispose.mock.callCount(),0);
 world.model.groups.clear();world.sync();assert.equal(dispose.mock.callCount(),1);assert.equal(world.pendingRigs.size,0);assert.equal(world.rigs.size,0);assert.equal(world.root.children.length,0);
});
