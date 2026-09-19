import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferedPresentation} from '../../js/fx/BufferedPresentation.js';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 const captures=[],workers=[],events=new Map();
 globalThis.document={hidden:false,addEventListener(type,fn){events.set(type,fn);},removeEventListener(type){events.delete(type);},createElement(){return{style:{},width:0,height:0,transferControlToOffscreen(){return{};},remove(){this.removed=true;}};}};
 globalThis.Worker=class{constructor(){this.messages=[];workers.push(this);}postMessage(message){this.messages.push(message);if(message.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready',supported:true}}));if(message.type==='reset')queueMicrotask(()=>this.onmessage({data:{type:'reset',epoch:message.epoch}}));}terminate(){this.terminated=true;}};
 globalThis.createImageBitmap=()=>new Promise((resolve,reject)=>captures.push({resolve,reject}));
 const source={width:32,height:64,style:{opacity:'.4'},transferControlToOffscreen(){},insertAdjacentElement(){}},produced=[];
 return{captures,workers,events,source,produced,create:options=>BufferedPresentation.create({source,depth:2,produce:dt=>produced.push(dt),present(){},onFrame(){},...options})};
}
const bitmap=()=>({closed:0,close(){this.closed++;}});
test('idle work waits until every requested image has been transferred',async()=>{
 const f=setup(),idle=[],m=await f.create({onIdle(){idle.push({busy:m.busy,credits:m.credits,frames:f.workers[0].messages.filter(m=>m.type==='frame').length});}});
 m.resume();await settle();assert.equal(idle.length,0);
 f.captures[0].resolve(bitmap());await new Promise(r=>setTimeout(r,5));assert.equal(idle.length,0);
 f.captures[1].resolve(bitmap());await new Promise(r=>setTimeout(r,5));
 assert.deepEqual(idle,[{busy:false,credits:0,frames:2}]);m.dispose();
});
test('resize rejects an old in-flight image and refills the current generation',async()=>{
 const f=setup(),m=await f.create();m.resume();await settle();assert.equal(f.captures.length,1);
 const old=bitmap();m.resize();await settle();f.captures[0].resolve(old);await settle();
 assert.equal(old.closed,1);assert.equal(f.captures.length,2);
 const current=bitmap();f.captures[1].resolve(current);await settle();
 const frames=f.workers[0].messages.filter(m=>m.type==='frame');assert.equal(frames.length,1);assert.equal(frames[0].epoch,m.epoch);assert.equal(frames[0].bitmap,current);
 m.dispose();await new Promise(r=>setTimeout(r,5));for(const capture of f.captures.slice(2))capture.resolve(bitmap());await settle();assert.equal(f.source.style.opacity,'.4');
});
test('a capture rejected after suspension does not disable later rendering',async()=>{
 const f=setup(),m=await f.create();m.resume();await settle();m.suspend();f.captures[0].reject(Error('old surface'));await settle();
 assert.equal(m.failed,false);m.resume();await settle();assert.equal(f.captures.length,2);m.dispose();const b=bitmap();f.captures[1].resolve(b);await settle();assert.equal(b.closed,1);
});
test('visibility suspension releases the presentation surface and cancels capture ownership',async()=>{
 const f=setup(),m=await f.create();m.resume();await settle();f.source.style.opacity='0';document.hidden=true;f.events.get('visibilitychange')();
 assert.equal(m.active,false);assert.equal(f.source.style.opacity,'.4');const b=bitmap();f.captures[0].resolve(b);await settle();assert.equal(b.closed,1);m.dispose();assert.equal(f.events.size,0);
});
test('an unresponsive worker restores the direct renderer',async()=>{
 const f=setup(),m=await f.create();m.resume();await settle();m.lastResponse=performance.now()-1100;
 const warn=console.warn;console.warn=()=>{};try{assert.equal(m.healthy(),true);const pending=[...m.pending.values()][0];pending.reject(Error('worker did not reply'));await settle();}finally{console.warn=warn;}
 assert.equal(m.failed,true);assert.equal(f.workers[0].terminated,true);assert.equal(f.source.style.opacity,'.4');f.captures[0].resolve(bitmap());await settle();
});

test('explicit disposal is terminal and rejects late capture ownership',async()=>{
 const f=setup(),m=await f.create();m.resume();await settle();m.dispose();const count=f.workers[0].messages.length;
 m.resume();m.resize();m.dispose();assert.equal(m.active,false);assert.equal(m.healthy(),false);assert.equal(f.workers[0].messages.length,count);
 await assert.rejects(m.request('stats'),/unavailable/);const late=bitmap();f.captures[0].resolve(late);await settle();assert.equal(late.closed,1);assert.equal(f.events.size,0);
});

test('a synchronous worker-construction failure releases the inserted canvas and listener',async()=>{
 const f=setup(),create=document.createElement;let display;document.createElement=(...a)=>(display=create(...a));
 globalThis.Worker=class{constructor(){throw Error('Worker blocked');}};
 const warn=console.warn;console.warn=()=>{};let result;try{result=await f.create();}finally{console.warn=warn;}
 assert.equal(result,null);assert.equal(display.removed,true);assert.equal(f.events.size,0);assert.equal(f.source.style.opacity,'.4');
});
