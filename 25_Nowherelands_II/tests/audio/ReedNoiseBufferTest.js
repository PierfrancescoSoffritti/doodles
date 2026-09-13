import test from 'node:test';
import assert from 'node:assert/strict';
import {warmReedVoice,reedNoiseBuffer} from '../../js/audio/ReedWalkerVoice.js?v=stable-30-3';
import {reedVoice,reedIndividual} from '../../js/world/fauna/ReedWalkerTraits.js?v=reed-5';
test('all world reed calls reuse startup buffers with byte-exact original noise',()=>{
 let count=0;const ctx={sampleRate:44100,createBuffer(channels,size,rate){count++;const data=new Float32Array(size);return{getChannelData:()=>data};}};
 warmReedVoice(ctx);assert.equal(count,6);
 for(const age of ['young','adult','old'])for(const sex of ['male','female'])for(const event of ['rumble','breath']){
  const traits=reedIndividual('reedbed',1,age,sex);
  for(const note of reedVoice(traits,event)){
   const buffer=reedNoiseBuffer(ctx,note),actual=buffer.getChannelData(0),expected=new Float32Array(Math.ceil(note.duration*ctx.sampleRate));let seed=731;
   for(let i=0;i<expected.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;expected[i]=(seed/2147483648-1)*note.air;}
   assert.deepEqual(actual,expected);
  }
 }
 assert.equal(count,6,'no PCM allocation or synthesis during world calls');
});
