import test from 'node:test';
import assert from 'node:assert/strict';
import {replyHighlight} from '../../js/world/fauna/ReplyHighlight.js?v=player-notes-13';
import {CreatureReplyAudio} from '../../js/audio/CreatureReplyAudio.js?v=pebble-voice-4b';
import {PlayerNotes} from '../../js/player/PlayerNotes.js?v=pebble-voice-4b';
const node=()=>({gain:{value:0},playbackRate:{value:1},connect(){},disconnect(){},start(){},stop(){}});
const engine=()=>({now:0,master:node(),reverb:node(),duck(){},makePanner:()=>node(),ctx:{state:'running',sampleRate:22050,createGain:node,createBufferSource:node,createBuffer:(n,length,rate)=>({duration:length/rate,copyToChannel(){}})}});
test('reply audio reports actual playback starts separately from queued or muted replies',()=>{
 const e=engine(),a=new CreatureReplyAudio(e),starts=[];a.onStart=(c,d,t)=>starts.push({c,d,t});
 for(let i=0;i<5;i++)a.play('hopper',{pos:{x:i,y:0,z:0}});
 let ended=0;a.onEnd=()=>ended++;a.voices[0].source.onended();assert.equal(ended,1);assert.equal(starts.length,4);assert.equal(a.pending.length,1);assert.ok(starts[0].t>=.015&&starts[0].t<=.07);
 a.muted=true;a.play('bird',{pos:{x:0,y:0,z:0}});assert.equal(starts.length,4);
 const {t,d}=starts[0];assert.equal(replyHighlight(t-.01,t,t+d),0);assert.equal(replyHighlight(t+.2,t,t+d),1);assert.equal(replyHighlight(t+d,t,t+d),0);
});
test('charged player notes have a distinct lower layered voice while emitting just one note',async()=>{
 const tones=[],e={now:1,ctx:{state:'running'},playerBus:{},duck(){},playTone:p=>tones.push(p)};
 const player={shared:{audio:e,player:{position:{x:0,y:0,z:0}},conductor:{scale:{freq:(degree,octave)=>100*2**octave}}},last:-100,serial:0,button:{dataset:{}}};
 await PlayerNotes.prototype.send.call(player,0);e.now=2;await PlayerNotes.prototype.send.call(player,1);
 assert.equal(tones.length,2);assert.equal(tones[0].voices,1);assert.equal(tones[1].voices,3);assert.ok(tones[1].freq<tones[0].freq);assert.notEqual(tones[0].type,tones[1].type);assert.ok(tones[1].duration>tones[0].duration);
});

test('every blip highlights all six nearby species even during cooldowns or muted replies',()=>{
 const at=x=>({x,y:100,z:0}),creatures=['lumen','hopper','ray'].map(kind=>({kind,pos:at(30),noteResponse:{end:20},noteCooldown:30}));
 const edge={pos:at(82.5)},far={pos:at(82.51)},reed={position:at(40)},bird={pose:{position:at(50)}},mite={pos:at(500)};
 const shared={audio:{now:1},fauna:{audio:{muted:true},model:{creatures:[...creatures,edge,far]}},
  walkers:{root:{visible:true},model:{groups:new Map([['family',{members:[reed]}]])}},
  birds:{root:{visible:true},encounters:[bird]},
  mites:{root:{visible:true},colonies:new Map([['colony',{model:{mites:[mite]},position:()=>at(60)}]])}};
 const player=Object.assign(Object.create(PlayerNotes.prototype),{shared,highlights:new Set()});
 const blip={position:at(0),velocity:.35,radius:82.5};player.highlightNearby(blip);
 assert.equal(player.highlights.size,7);assert.ok(!player.highlights.has(far));
 for(const c of [...creatures,edge,reed,bird,mite]){assert.ok(player.highlights.has(c));assert.equal(c.replyStart,1);assert.equal(c.replyEnd,1.8);}
 shared.audio.now=1.2;player.highlightNearby(blip);
 for(const c of player.highlights){assert.equal(c.replyStart,1.2);assert.equal(c.replyEnd,2);assert.equal(replyHighlight(1.3,c.replyStart,c.replyEnd),1);}
 player.highlightNearby({...blip,velocity:.95,radius:165});assert.ok(player.highlights.has(far));assert.equal(far.replyEnd,2.3);
});

test('echo animation tracks each creature’s blip progress and charge independently',()=>{
 const saved=globalThis.document;globalThis.document={hidden:false};
 try{
  const shared={audio:{now:10},fauna:{audio:{muted:true}}};
  const player=Object.assign(Object.create(PlayerNotes.prototype),{shared,highlights:new Set(),button:{dataset:{}},inspectAt:Infinity});
  const soft={},charged={};player.highlight(soft,.8);shared.audio.now=10.2;player.highlight(charged,1.1);
  shared.audio.now=10.4;player.update();
  assert.ok(Math.abs(soft.replyProgress-.5)<1e-8);assert.ok(Math.abs(charged.replyProgress-2/11)<1e-8);
  assert.equal(soft.replyCharged,false);assert.equal(charged.replyCharged,true);
  assert.equal(soft.replyGlow,1);assert.equal(charged.replyGlow,1);
  shared.audio.now=11.4;player.update();assert.equal(player.highlights.size,0);assert.equal(soft.replyGlow,0);assert.equal(charged.replyGlow,0);
 }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});

test('pebbles retain distinct voices across reply order, movement and buffer eviction',()=>{
 const e=engine(),audio=new CreatureReplyAudio(e),starts=[];audio.onStart=(c,d,t)=>starts.push({d,t});
 const pebbles=Array.from({length:4},(_,i)=>({id:`colony:${i}`,size:.8+i*.25,pos:{x:i,y:0,z:0}}));
 for(const c of pebbles)audio.play('hopper',c);
 const buffers=audio.voices.map(v=>v.source.buffer);
 assert.equal(new Set(buffers).size,4);assert.equal(new Set(starts.map(s=>s.t)).size,4);
 for(let i=0;i<4;i++){
  assert.ok(starts[i].t>=.015&&starts[i].t<=.07);
  assert.ok(Math.abs(audio.voices[i].end-(starts[i].t+buffers[i].duration+.005))<1e-8);
 }
 for(const v of [...audio.voices])v.source.onended();
 for(const c of pebbles.toReversed()){c.pos.x+=100;audio.play('hopper',c);}
 assert.deepEqual(audio.voices.map(v=>v.source.buffer),buffers.toReversed());
 assert.deepEqual(starts.slice(4),starts.slice(0,4).toReversed());
 const profile=audio.pebbleProfiles.get(pebbles[0]);
 for(let i=0;i<80;i++){
  e.now+=2;audio.play('hopper',{id:`other:${i}`,pos:{x:0,y:0,z:0}});
 }
 assert.equal(audio.buffers.size,64);
 e.now+=2;audio.play('hopper',pebbles[0]);assert.deepEqual(audio.pebbleProfiles.get(pebbles[0]),profile);
});
