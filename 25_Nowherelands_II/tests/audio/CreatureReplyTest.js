import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeCreatureReply,REPLY_DURATION} from '../../js/audio/CreatureReplyAudio.js?v=player-notes-13';

test('every reply and alarm has finite, audible, bounded samples with quiet endpoints',()=>{
 for(const kind of Object.keys(REPLY_DURATION))for(const alarm of [false,true])for(const rate of [22050,48000]){
  const data=synthesizeCreatureReply(kind,alarm,rate);let peak=0,sum=0;
  for(const v of data){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  assert.ok(peak>.81&&peak<.83);assert.ok(Math.sqrt(sum/data.length)>.15);assert.equal(data[0],0);assert.ok(Math.abs(data.at(-1))<.001);
 }
});
test('reply families and stronger alarms have distinct waveforms',()=>{
 const voices=Object.keys(REPLY_DURATION).map(kind=>synthesizeCreatureReply(kind,false,22050));
 for(let i=0;i<voices.length;i++)for(let j=i+1;j<voices.length;j++)assert.notDeepEqual(voices[i],voices[j]);
 for(const kind of Object.keys(REPLY_DURATION))assert.notDeepEqual(synthesizeCreatureReply(kind,false,22050),synthesizeCreatureReply(kind,true,22050));
});
