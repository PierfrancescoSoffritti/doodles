import test from 'node:test';
import assert from 'node:assert/strict';
import {LanternMiteAudio} from '../../js/audio/LanternMiteVoice.js?v=stable-30-3';
import {LanternMiteBuffers} from '../../js/audio/LanternMiteBuffers.js?v=stable-30-3';
import {lanternSamples} from '../../js/audio/LanternMiteSamples.js?v=stable-30-3';
function fixture(){
 const sent=[],sources=[],worker={postMessage:job=>sent.push(job),terminate(){}},param=()=>({value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}}),node=()=>({gain:param(),connect(){},disconnect(){},start(){this.started=true;},stop(){}});
 const ctx={sampleRate:32000,createBuffer:(c,length,rate)=>({samples:new Float32Array(length),copyToChannel(a){this.samples.set(a);}}),createGain:node,createBufferSource:()=>{const source=node();sources.push(source);return source;}};
 const engine={ctx,now:0,reedPeakGuard:true,master:node(),makePanner:node};
 const audio=new LanternMiteAudio(engine);audio.bank.dispose();audio.bank=new LanternMiteBuffers(ctx,{workerFactory:()=>worker});audio.buffers=audio.bank.cache;
 const deliver=job=>worker.onmessage({data:{id:job.id,samples:lanternSamples(job.options.mite,job.options.reply,job.options.sampleRate)}});
 return{audio,sent,sources,deliver};
}
const mite={id:2,size:.12,colonyId:'oak',pos:{x:1,y:2,z:3}};
test('preparing both calls shares requests and playback uses the prepared PCM immediately',async()=>{
 const {audio,sent,sources,deliver}=fixture();try{
 const ready=audio.prepare([mite]),duplicate=audio.prepare([mite]);assert.equal(sent.length,2);
 for(const job of sent)deliver(job);await Promise.all([ready,duplicate]);
 assert.equal(audio.play(mite),true);assert.equal(sent.length,2);assert.equal(sources.length,1);assert.equal(sources[0].started,true);
 assert.deepEqual(sources[0].buffer.samples,lanternSamples(mite,false,32000));sources[0].onended();assert.equal(audio.voices.size,0);
 }finally{audio.dispose();}
});
test('silencing or disposing a colony cancels queued cold calls before any source starts',async()=>{
 const {audio,sent,sources,deliver}=fixture();
 const cancelled=audio.play(mite);audio.silence('oak');deliver(sent[0]);assert.equal(await cancelled,false);assert.equal(sources.length,0);
 const jobs=[0,1,3].map(id=>audio.play({...mite,id}));assert.equal(audio.play({...mite,id:4}),false,'pending calls share the three-voice cap');
 audio.dispose();assert.deepEqual(await Promise.all(jobs),[false,false,false]);assert.equal(sources.length,0);assert.equal(audio.pending.size,0);
});
