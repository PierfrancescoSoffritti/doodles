import { CreatureReplyAudio } from '../audio/CreatureReplyAudio.js?v=pebble-voice-4b';
import {playerNoteRadius} from '../world/RippleWave.js?v=player-notes-13';
import {replyHighlight} from '../world/fauna/ReplyHighlight.js?v=player-notes-13';
export class PlayerNotes {
 constructor(shared){
  this.shared=shared;this.highlights=new Set();this.serial=0;this.last=-100;
  const down=()=>{this.pressed=performance.now();};
  const up=()=>{if(this.pressed===null||this.pressed===undefined)return;const duration=(performance.now()-this.pressed)/1000;this.pressed=null;this.send(Math.max(0,(duration-.28)/1.1));};
  this.keyDown=e=>{if(e.code==='KeyN'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)){e.preventDefault();down();}};
  this.keyUp=e=>{if(e.code==='KeyN')up();};document.addEventListener('keydown',this.keyDown);document.addEventListener('keyup',this.keyUp);
  this.cancel=()=>{this.pressed=null;};window.addEventListener('blur',this.cancel);
  this.visibility=()=>{if(document.hidden){this.cancel();this.replies?.silence();for(const c of [...this.highlights])this.clearHighlight(c);}};document.addEventListener('visibilitychange',this.visibility);
 }
 async send(charge=0){
  const s=this.shared;if(!s.audio){s.hud.enterBtn.click();await new Promise(resolve=>requestAnimationFrame(resolve));}if(!s.audio)return false;
  if(s.audio.ctx.state!=='running')await s.audio.resume();const e=s.audio;
  if(e.now-this.last<.16)return false;this.last=e.now;
  const degree=[0,2,4,2][this.serial++%4],loaded=charge>2/3;
  e.playTone({freq:s.conductor.scale.freq(degree,loaded?1:2),position:{x:s.player.position.x,y:s.player.position.y,z:s.player.position.z},velocity:.35+Math.min(1,charge)*.6,type:loaded?'triangle':'sine',voices:loaded?3:1,detune:loaded?7:0,octaveLayer:loaded?.35:0,attack:loaded?.055:.035,duration:loaded?.48:.22,release:loaded?.75:.4,cutoff:loaded?1300:2200,reverb:.2,dest:e.playerBus,layer:'player-note'});
  e.duck(.35,1.2);return true;
 }
 hear(note){
  const s=this.shared,size=.6+note.velocity*2,radius=playerNoteRadius(note.velocity);
  s.ripples.add(note.position.x,note.position.z,size,note.velocity>.75?.085:(s.hue+.15)%1,.9,radius);
  const stimulus={...note,radius};
  this.highlightNearby(stimulus);
  s.fauna.model.hear({...stimulus,strength:note.velocity});s.walkers?.hearNote(stimulus);s.birds?.hearNote(stimulus);s.mites?.hearNote(stimulus);
 }
 // Visual acknowledgment is independent of gesture cooldowns and voice availability.
 highlightNearby(note){
  const s=this.shared,p=note.position,duration=note.velocity>.75?1.1:.8;
  const pulse=(c,position)=>{if(position&&Math.hypot(position.x-p.x,position.z-p.z)<=note.radius)this.highlight(c,duration);};
  for(const c of s.fauna.model.creatures)pulse(c,c.pos);
  if((s.caveAmount||0)>=.4)return;
  if(s.walkers?.root.visible)for(const g of s.walkers.model.groups.values())for(const c of g.members)pulse(c,c.position);
  if(s.birds?.root.visible)for(const c of s.birds.encounters)pulse(c,c.pose.position);
  if(s.mites?.root.visible)for(const g of s.mites.colonies.values())for(const c of g.model.mites)pulse(c,g.position(c));
 }
 clearHighlight(creature){const owner=creature.replyOwner||creature;owner.replyGlow=0;owner.replyEnd=this.shared.audio?.now||0;this.highlights.delete(owner);}
 highlight(creature,duration,start=this.shared.audio?.now||0){
  const owner=creature.replyOwner||creature;owner.replyStart=start;owner.replyEnd=start+duration;owner.replyProgress=0;owner.replyCharged=duration>1;this.highlights.add(owner);
 }
 reply(kind,creature,alarm=false){const s=this.shared;if(!s.audio||document.hidden||s.fauna?.audio?.muted)return false;if(!this.replies)this.replies=new CreatureReplyAudio(s.audio);return this.replies.play(kind,creature,alarm);}
 update(){const now=this.shared.audio?.now||0,quiet=document.hidden;for(const c of this.highlights){c.replyProgress=Math.max(0,Math.min(1,(now-c.replyStart)/(c.replyEnd-c.replyStart)));c.replyGlow=quiet?0:replyHighlight(now,c.replyStart,c.replyEnd);if(now>=c.replyEnd||quiet){c.replyGlow=0;this.highlights.delete(c);}}if(this.replies){this.replies.muted=!!this.shared.fauna?.audio?.muted;this.replies.update();}
  if(performance.now()>(this.inspectAt||0)){this.inspectAt=performance.now()+200;const s=this.shared,groups={};
   const add=(kind,c,state)=>{const g=groups[kind]??={active:0,glow:0,states:[]};if(c.noteGlow>0){g.active++;g.glow=Math.max(g.glow,c.noteGlow);if(!g.states.includes(state))g.states.push(state);}};
   for(const c of s.fauna.model.creatures)add(c.kind,c,c.state||c.pebble?.state||c.navigation?.state);
   for(const g of s.walkers?.model.groups.values()||[])for(const c of g.members)add('reed',c,c.state);
   for(const c of s.birds?.encounters||[])add('bird',c,c.pose.state);
   for(const g of s.mites?.colonies.values()||[])for(const c of g.model.mites)add('mite',c,c.state);
   this.responses=groups;
  }}
 dispose(){for(const c of this.highlights)c.replyGlow=0;this.highlights.clear();this.replies?.dispose();window.removeEventListener('blur',this.cancel);document.removeEventListener('keydown',this.keyDown);document.removeEventListener('keyup',this.keyUp);document.removeEventListener('visibilitychange',this.visibility);}
}
