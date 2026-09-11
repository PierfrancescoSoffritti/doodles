import {pebbleSamples} from '../../js/audio/PebbleSoundBank.js?v=pebble-audio-10';
import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeCreatureReply,REPLY_DURATION,pebbleReplyProfile} from '../../js/audio/CreatureReplyAudio.js?v=pebble-voice-4b';

test('every reply and alarm has finite, audible, bounded samples with quiet endpoints',()=>{
 for(const kind of Object.keys(REPLY_DURATION))for(const alarm of [false,true])for(const rate of [22050,48000]){
  const data=synthesizeCreatureReply(kind,alarm,rate);let peak=0,sum=0;
  for(const v of data){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  assert.ok(peak>.81&&peak<.83);assert.ok(Math.sqrt(sum/data.length)>(kind==='hopper'?.065:.15));assert.equal(data[0],0);assert.ok(Math.abs(data.at(-1))<.001);
 }
});
test('reply families and stronger alarms have distinct waveforms',()=>{
 const voices=Object.keys(REPLY_DURATION).map(kind=>synthesizeCreatureReply(kind,false,22050));
 for(let i=0;i<voices.length;i++)for(let j=i+1;j<voices.length;j++)assert.notDeepEqual(voices[i],voices[j]);
 for(const kind of Object.keys(REPLY_DURATION))assert.notDeepEqual(synthesizeCreatureReply(kind,false,22050),synthesizeCreatureReply(kind,true,22050));
});

test('individual pebble voices vary in size-dependent pitch and contact rhythm with clean sample boundaries',()=>{
 const profiles=Array.from({length:12},(_,i)=>pebbleReplyProfile(`colony:${i}`,.75+i/11*1.05));
 for(const field of ['rate','spacing','closing','weight'])assert.equal(new Set(profiles.map(p=>p[field])).size,12);
 assert.ok(pebbleReplyProfile('same',1.8).rate<pebbleReplyProfile('same',.75).rate);
 for(let i=0;i<profiles.length;i++)for(const alarm of [false,true])for(const rate of [22050,48000]){
  const data=synthesizeCreatureReply('hopper',alarm,rate,profiles[i]);let peak=0,sum=0,jump=0;
  for(let j=0;j<data.length;j++){assert.ok(Number.isFinite(data[j]));peak=Math.max(peak,Math.abs(data[j]));sum+=data[j]**2;if(j)jump=Math.max(jump,Math.abs(data[j]-data[j-1]));}
  assert.ok(peak>.81&&peak<.83);assert.ok(Math.sqrt(sum/data.length)>.065);assert.ok(jump<.65*22050/rate);
  assert.equal(data[0],0);assert.equal(data.at(-1),0);
 }
 const voice=()=>synthesizeCreatureReply('hopper',false,22050,pebbleReplyProfile('repeat',1.2));
 assert.deepEqual(voice(),voice());
 assert.notDeepEqual(voice(),synthesizeCreatureReply('hopper',false,22050,pebbleReplyProfile('neighbor',1.2)));
});

test('reply contacts retain the walking sound instead of introducing an unrelated voice',()=>{
 for(const rate of [22050,48000])for(let variant=0;variant<3;variant++){
  const profile={...pebbleReplyProfile('walking',1),variant};
  const reply=synthesizeCreatureReply('hopper',false,rate,profile),step=pebbleSamples('step',rate,variant);
  let cross=0,replyEnergy=0,stepEnergy=0;
  for(let i=0;i<Math.floor(rate*.08);i++){
   cross+=reply[i]*step[i];replyEnergy+=reply[i]**2;stepEnergy+=step[i]**2;
  }
  assert.ok(cross/Math.sqrt(replyEnergy*stepEnergy)>.9,'first contact preserves the footstep timbre');
 }
});
