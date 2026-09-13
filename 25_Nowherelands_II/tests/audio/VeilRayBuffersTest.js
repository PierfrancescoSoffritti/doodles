import test from 'node:test';
import assert from 'node:assert/strict';
import {VeilRayBuffers} from '../../js/audio/VeilRayBuffers.js?v=stable-30-3';
import {synthesizeVeilRay} from '../../js/audio/VeilRayVoice.js?v=stable-30-3';
const ctx={createBuffer(channels,length,sampleRate){return{samples:new Float32Array(length),sampleRate,copyToChannel(samples){this.samples.set(samples);}};}};
const options={sampleRate:22050,frequency:173,phrase:'contact',size:1.2,identity:.7};
test('ray PCM requests share work and retain the exact samples with a bounded cache',async()=>{
 const sent=[],worker={postMessage(data){sent.push(data)},terminate(){}};
 const bank=new VeilRayBuffers(ctx,{workerFactory:()=>worker});
 const a=bank.request(options);assert.equal(bank.request(options),a);assert.equal(sent.length,1);
 const samples=synthesizeVeilRay(options);worker.onmessage({data:{id:sent[0].id,samples}});
 const buffer=await a;assert.deepEqual(buffer.samples,samples);assert.equal(await bank.request(options),buffer);assert.equal(sent.length,1);
 for(let i=0;i<15;i++){const p=bank.request({...options,identity:i});const job=sent.at(-1);worker.onmessage({data:{id:job.id,samples}});await p;}
 assert.equal(bank.cache.size,12);bank.dispose();
});
test('worker failure finishes the same waveform in cooperative slices; disposal cancels pending audio',async()=>{
 const worker={postMessage(){},terminate(){}};
 const bank=new VeilRayBuffers(ctx,{workerFactory:()=>worker});
 const pending=bank.request(options);worker.onerror({preventDefault(){}});
 assert.deepEqual((await pending).samples,synthesizeVeilRay(options));
 const stopped=bank.request({...options,identity:2});bank.dispose();assert.equal(await stopped,null);assert.equal(bank.pending.size,0);assert.equal(bank.cache.size,0);
});
