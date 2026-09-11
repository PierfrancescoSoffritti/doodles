import test from 'node:test';
import assert from 'node:assert/strict';
import {replyHighlight} from '../../js/world/fauna/ReplyHighlight.js?v=player-notes-13';
import {CreatureReplyAudio} from '../../js/audio/CreatureReplyAudio.js?v=player-notes-13';
import {PlayerNotes} from '../../js/player/PlayerNotes.js?v=player-notes-13';
const node=()=>({gain:{value:0},connect(){},disconnect(){},start(){},stop(){}});
const engine=()=>({now:0,master:node(),reverb:node(),duck(){},makePanner:()=>node(),ctx:{state:'running',sampleRate:22050,createGain:node,createBufferSource:node,createBuffer:(n,length,rate)=>({duration:length/rate,copyToChannel(){}})}});
test('reply audio reports actual playback starts separately from queued or muted replies',()=>{
 const e=engine(),a=new CreatureReplyAudio(e),starts=[];a.onStart=(c,d,t)=>starts.push({c,d,t});
 for(let i=0;i<5;i++)a.play('hopper',{pos:{x:i,y:0,z:0}});
 let ended=0;a.onEnd=()=>ended++;a.voices[0].source.onended();assert.equal(ended,1);assert.equal(starts.length,4);assert.equal(a.pending.length,1);assert.equal(starts[0].t,.015);
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
