import test from 'node:test';
import assert from 'node:assert/strict';
import {VegetationAudio} from '../../js/atelier/VegetationAudio.js';
import {VegetationStudy} from '../../js/atelier/VegetationStudy.js';

const param=()=>({value:0,cancelAndHoldAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
function fixture(){
 const nodes=[];
 const node=()=>{const n={gain:param(),frequency:param(),pan:param(),Q:param(),disconnects:0,connect(){},disconnect(){this.disconnects++;},start(){},stop(time){if(time===undefined)this.onended?.();}};nodes.push(n);return n;};
 const ctx={state:'running',currentTime:0,sampleRate:44100,destination:{},createGain:node,createOscillator:node,createStereoPanner:node,createBufferSource:node,createBiquadFilter:node,
  createBuffer:(channels,length)=>({getChannelData:()=>new Float32Array(length)}),async suspend(){this.state='suspended';},async close(){this.state='closed';}};
 const audio=new VegetationAudio();audio.context=ctx;audio.master=node();return {audio,ctx,nodes};
}
test('overlapping reed and mirror audition voices stay bounded and stop releases the graph',()=>{
 const {audio,nodes}=fixture(),model=new VegetationStudy();
 for(let i=0;i<40;i++)audio.play({kind:i%2?'reed':'mirror',plant:0,part:i%3},model);
 assert.ok(audio.sources.size<=24);assert.ok(audio.retiring.size>0);audio.stop();assert.equal(audio.retiring.size,0);assert.equal(audio.sources.size,0);
 assert.ok(nodes.slice(1).every(n=>n.disconnects===1));
});
test('disabled or suspended audio cannot restart from queued visual replies',async()=>{
 const {audio,ctx}=fixture(),model=new VegetationStudy();audio.enabled=false;
 audio.play({kind:'reed',plant:0,part:0},model);assert.equal(audio.sources.size,0);
 audio.enabled=true;await audio.suspend();assert.equal(ctx.state,'suspended');
 audio.play({kind:'mirror',plant:0,part:0},model);assert.equal(audio.sources.size,0);
 await audio.dispose();assert.equal(ctx.state,'closed');assert.equal(audio.context,null);
});
test('lily replies reuse the audition voice without requiring a reed stem collection',()=>{
 const {audio}=fixture();audio.play({kind:'lily',plant:0,part:2},{plants:[{x:1.5}]});
 assert.equal(audio.sources.size,3);audio.stop();assert.equal(audio.sources.size,0);
});
test('stopping during an asynchronous unlock stays quiet; a newer intentional unlock survives',async()=>{
 const {audio,ctx}=fixture();let resume;
 ctx.resume=()=>new Promise(resolve=>{resume=()=>{ctx.state='running';resolve();};});
 ctx.state='suspended';const old=audio.unlock();audio.stop();resume();await old;assert.equal(ctx.state,'suspended');
 let first;ctx.resume=()=>new Promise(resolve=>{first=resolve;});const stale=audio.unlock();audio.stop();
 ctx.resume=async()=>{ctx.state='running';};await audio.unlock();first();await stale;assert.equal(ctx.state,'running');
});
