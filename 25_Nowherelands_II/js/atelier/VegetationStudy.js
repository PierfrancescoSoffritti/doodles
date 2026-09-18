import { Random } from '../core/Random.js';

export const REED_FORMS = ['young', 'mature', 'weathered'];
export const WILLOW_FORMS = ['ribbons', 'sprays', 'veils'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Flower size gives a stable voice: small companions answer higher and settle sooner.
export function reedVoice(plant,stem){
 const size=clamp((plant.scale*stem.size-.12)/.3,0,1);
 return {degree:Math.round((1-size)*6),octave:2,decay:.7+size*.8,attack:.065+size*.085,lightDecay:3.4-size*1.2};
}

// Independent of rendering/audio so a later world adapter can reuse identities and responses.
export class VegetationStudy {
 constructor({species = 'bell-reed', form, seed = 'stillwater', serial = 1, group = false, pendants = true} = {}) {
  this.species = species === 'veil-willow' ? species : 'bell-reed';
  this.seed = seed; this.serial = serial; this.group = group; this.pendants = pendants;
  const forms = this.species === 'bell-reed' ? REED_FORMS : WILLOW_FORMS;
  this.form = forms.includes(form) || form === 'mixed' ? form : forms[1];
  this.time = 0; this.wind = .3; this.brushStart = -100;
  this.events = []; this.pending = []; this.sequence = 0; this.plants = []; this.lastNote=-100; this.noteCount=0;
  this.replyRandom=new Random(`${seed}:${serial}:reed-replies`);
  const rnd = new Random(`${seed}:${this.species}:${serial}`);
  const count = group ? 3 : 1;
  for (let i = 0; i < count; i++) {
   const form = this.form === 'mixed' ? forms[i % forms.length] : this.form;
   const spacing = this.species === 'bell-reed' ? 2.15 : 5.5;
   const plant = {id:i, form, x:group ? (i - 1) * spacing : 0, z:group ? [0, -.8, .5][i] : 0,
    scale:rnd.range(.9, 1.1), yaw:rnd.range(-.35, .35), phase:rnd.range(0, 6.28), tint:rnd.range(-.035, .035), stems:[], mirrors:[]};
   if (this.species === 'bell-reed') {
    const n = form === 'young' ? 3 : form === 'weathered' ? 4 : rnd.int(5, 7);
    for (let j = 0; j < n; j++) plant.stems.push({id:j, angle:j / n * Math.PI * 2 + rnd.range(-.2, .2),
     height:rnd.range(2.15, 3.5) * (form === 'young' ? .7 : 1), spread:rnd.range(.35, .8),
     size:rnd.range(.27, .39) * (form === 'young' ? .8 : 1), phase:rnd.range(0, 6.28),
     worn:form === 'weathered' && j % 2 === 0, pulseAt:-100, energy:0});
   } else if (pendants) {
    for (let j = 0; j < 2; j++) plant.mirrors.push({id:j, pulseAt:-100, energy:0, swing:0, swingVelocity:0, echoStart:-100, echoUntil:-100, echoCharged:false});
   }
   this.plants.push(plant);
  }
 }
 emit(kind, plant, part, strength = 1, details = {}) {
  this.events.push({sequence:++this.sequence, time:this.time, kind, plant, part, strength, ...details});
 }
 offerNote(charge = 0, source = 'player', target = null, delay = 0) {
  if (source !== 'player' || this.species !== 'bell-reed') return false;
  charge=clamp(Number.isFinite(charge)?charge:0,0,1);
  const interval=this.time-this.lastNote,continuing=interval<1.8;
  const waiting=new Set(this.pending.map(r=>`${r.plant}:${r.part}`));
  const candidates=this.plants.flatMap(plant=>plant.stems.map(stem=>({
   plant:plant.id,part:stem.id,stem,voice:reedVoice(plant,stem),
   // Quiet flowers get a turn, in a fresh seeded order. Distance does not rank replies.
   rank:(stem.replyCount||0)+this.replyRandom.next()*.9+(waiting.has(`${plant.id}:${stem.id}`)?1000:0),
  })));
  if(!candidates.length)return false;
  if(charge>2/3){
   // Charged blips replace the phrase with one shared onset for every flower.
   this.pending=candidates.map(c=>({plant:c.plant,part:c.part,at:this.time+.045,strength:1,chorus:true}));
   this.lastNote=this.time;this.noteCount++;this.emit('invitation',0,0,charge);return true;
  }
  candidates.sort((a,b)=>a.rank-b.rank);
  const aimed=candidates.findIndex(c=>c.plant===target?.plant&&c.part===target?.part);
  const lead=candidates.splice(aimed<0?0:aimed,1)[0],chosen=[lead],seen=new Set([lead.plant]);
  const count=Math.min(candidates.length+1,charge>.5?Math.round(3+charge*5):continuing&&interval<.5&&aimed<0?1:2+(this.noteCount%3===2?1:0));
  while(chosen.length<count){
   candidates.sort((a,b)=>a.rank-b.rank+(charge>.5?(seen.has(a.plant)?5:0)-(seen.has(b.plant)?5:0):0));
   const next=candidates.shift();chosen.push(next);seen.add(next.plant);
  }
  const beat=continuing?clamp(interval*.6,.12,.32):.23;
  let at=this.time+.045+delay;
  const replies=chosen.map((c,i)=>{
   if(i)at+=beat*(c.voice.decay<1?.8:1.1)+(i%2?.035:0);
   return {plant:c.plant,part:c.part,at,strength:(i? .68:.9)+charge*(i?.3:.1)};
  });
  // Keep already travelling answers on a tap. A held invitation grows a fresh
  // wave through the family. Uncharged phrases keep at most eight future bells.
  const keys=new Set(replies.map(r=>`${r.plant}:${r.part}`));
  const tail=charge>.5?[]:this.pending.filter(r=>!keys.has(`${r.plant}:${r.part}`));
  this.pending=[...replies,...tail].sort((a,b)=>a.at-b.at).slice(0,8);
  this.lastNote=this.time;this.noteCount++;this.emit('invitation',lead.plant,lead.part,charge);
  return true;
 }
 brush() {
  if (this.species !== 'bell-reed' || this.time - this.brushStart < 3.5) return false;
  this.brushStart = this.time; this.emit('brush', 0, 0, .7); return true;
 }
 touchMirror(plantId = 0, part = 0, charge = 0, sound = true) {
  const mirror = this.plants[plantId]?.mirrors[part];
  if (!mirror) return false;
  charge=clamp(Number.isFinite(charge)?charge:0,0,1);
  // A click adds momentum, never resets the current pose or oscillation phase.
  const direction=mirror.swingVelocity<0?-1:1;
  const speedLimit=Math.min(1.8,Math.sqrt(Math.max(0,4-25*mirror.swing*mirror.swing)));
  mirror.swingVelocity=clamp(mirror.swingVelocity+direction*(.85+charge*.4),-speedLimit,speedLimit);
  mirror.pulseAt=this.time;mirror.energy=Math.min(1,mirror.energy+.55);
  // Let an existing contour finish travelling before starting another echo.
  if(this.time>=mirror.echoStart+.9){mirror.echoStart=this.time;mirror.echoCharged=charge>.5;}
  mirror.echoUntil=this.time+.9;
  if(sound)this.emit('mirror',plantId,part);
  return true;
 }
 visitor() {
  const t = this.time - this.brushStart;
  return {active:t >= 0 && t < 3.5, x:(t / 3.5 - .5) * (this.group ? 9 : 4), z:.35};
 }
 brushBend(plant) {
  const v = this.visitor();
  if (!v.active) return 0;
  return Math.exp(-((v.x - plant.x) ** 2 + (v.z - plant.z) ** 2) / .7) * .27;
 }
 update(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  this.time += dt;
  while (this.pending.length && this.pending[0].at <= this.time) {
   const event = this.pending.shift(), stem = this.plants[event.plant].stems[event.part];
   const voice=reedVoice(this.plants[event.plant],stem);
   stem.pulseAt=event.at;stem.pulseStrength=event.strength;stem.pulseAttack=event.chorus?.09:voice.attack;stem.pulseDecay=voice.lightDecay;
   stem.replyCount=(stem.replyCount||0)+1;
   (stem.nods??=[]).push({at:event.at,strength:event.strength});
   this.emit('reed',event.plant,event.part,event.strength,{chorus:!!event.chorus});
  }
  for (const plant of this.plants) for (const part of plant.stems) {
   const age = this.time - part.pulseAt;
   const reply=age < 0 ? 0 : Math.max(0, Math.sin(Math.min(1, age / (part.pulseAttack||.18)) * Math.PI / 2) * Math.exp(-age*(part.pulseDecay||2.2)))*(part.pulseStrength??1);
   part.energy = reply;
   part.nods=(part.nods||[]).filter(n=>this.time-n.at<2.5);
   // Overlapping impulses start at zero displacement, so rapid clicks never snap the pose.
   const nod=part.nods.reduce((sum,n)=>{const age=this.time-n.at;return sum+Math.sin(age*9)*Math.exp(-age*3)*n.strength;},0);
   part.nod=.48*Math.tanh(nod);

  }
  // Exact damped-spring step keeps the same swing at different frame rates.
  const damping=1.5,stiffness=25,frequency=Math.sqrt(stiffness-damping*damping);
  const decay=Math.exp(-damping*dt),cos=Math.cos(frequency*dt),sin=Math.sin(frequency*dt);
  for(const plant of this.plants)for(const mirror of plant.mirrors){
   const x=mirror.swing,v=mirror.swingVelocity;
   mirror.swing=decay*(x*cos+(v+damping*x)/frequency*sin);
   mirror.swingVelocity=decay*(v*cos-(damping*v+stiffness*x)/frequency*sin);
   mirror.energy*=Math.exp(-dt*2.2);
   if(this.time>=mirror.echoStart+.9&&this.time<mirror.echoUntil)mirror.echoStart+=Math.floor((this.time-mirror.echoStart)/.9)*.9;
  }
 }
 drainEvents() { return this.events.splice(0); }
 get status() {
  if (this.visitor().active) return 'A passing visitor · stems yield and settle';
  if (this.pending.length || this.plants.some(p => [...p.stems, ...p.mirrors].some(s => s.energy > .025)))
   return this.species === 'bell-reed' ? 'A small answering phrase' : 'The mirrors ring and settle';
  return this.wind > .65 ? 'A stronger breeze' : 'Resting in the breeze';
 }
}
