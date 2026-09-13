import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};if(specifier.startsWith('three/addons/'))return{url:new URL('../../../common/libs/three-0.185/examples/jsm/'+specifier.slice(13),import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const {WorldBirds}=await import('../../js/world/fauna/WorldBirds.js?v=stable-30-3');

function fixture(work,budget=1){
 const chunk={},chunks=new Map([['tree',chunk]]);
 return Object.assign(Object.create(WorldBirds.prototype),{vegetation:{chunks},streamChunks:[...chunks],streamWork:work,streamBudget:budget,time:12,nextStream:14});
}

test('an unloaded bird habitat cancels its unfinished population before publication',()=>{
 let cancelled=false,published=false;
 const work=(function*(){try{yield;published=true;}finally{cancelled=true;}})();work.next();
 const birds=fixture(work);birds.vegetation.chunks.set('tree',{});
 birds.drainStream();
 assert.equal(cancelled,true);assert.equal(published,false);assert.equal(birds.streamWork,null);assert.equal(birds.nextStream,12);
});

test('mobile preparation yields between complete candidates and desktop can drain it',()=>{
 let completed=0;
 const work=(function*(){for(let i=0;i<3;i++){const until=performance.now()+2;while(performance.now()<until){}completed++;yield;}})();
 const birds=fixture(work);birds.drainStream();assert.equal(completed,1);assert.ok(birds.streamWork);
 birds.streamBudget=0;birds.drainStream();assert.equal(completed,3);assert.equal(birds.streamWork,null);
});
