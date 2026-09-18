import { Random } from '../core/Random.js';

export const REED_FORMS = ['young', 'mature', 'weathered'];
export const WILLOW_FORMS = ['ribbons', 'sprays', 'veils'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Independent of rendering/audio so a later world adapter can reuse identities and responses.
export class VegetationStudy {
 constructor({species = 'bell-reed', form, seed = 'stillwater', serial = 1, group = false, pendants = true} = {}) {
  this.species = species === 'veil-willow' ? species : 'bell-reed';
  this.seed = seed; this.serial = serial; this.group = group; this.pendants = pendants;
  const forms = this.species === 'bell-reed' ? REED_FORMS : WILLOW_FORMS;
  this.form = forms.includes(form) || form === 'mixed' ? form : forms[1];
  this.time = 0; this.wind = .3; this.brushStart = -100;
  this.events = []; this.pending = []; this.sequence = 0; this.plants = [];
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
 emit(kind, plant, part, strength = 1) {
  this.events.push({sequence:++this.sequence, time:this.time, kind, plant, part, strength});
 }
 offerNote(charge = 0, source = 'player') {
  if (source !== 'player' || this.species !== 'bell-reed') return false;
  charge = clamp(Number.isFinite(charge) ? charge : 0, 0, 1);
  // Restart the answering phrase instead of blocking a new invitation. Keep an
  // imminent reply's deadline so fast repeated notes cannot postpone it forever.
  const start = Math.min(this.time + .18, this.pending[0]?.at ?? Infinity);
  this.pending.length = 0;
  this.emit('invitation', 0, 0, charge);
  const candidates = this.plants.flatMap(p => p.stems.map(s => ({plant:p.id, part:s.id, distance:Math.abs(p.x)})))
   .sort((a,b) => (a.distance+a.part*.5) - (b.distance+b.part*.5) || a.part - b.part);
  const count = Math.min(candidates.length, charge > .5 ? 8 : 3);
  for (let i = 0; i < count; i++) this.pending.push({...candidates[i], at:start + i * .19, strength:.7 + charge * .3});
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
   stem.pulseAt = event.at; this.emit('reed', event.plant, event.part, event.strength);
  }
  for (const plant of this.plants) for (const part of plant.stems) {
   const age = this.time - part.pulseAt;
   const reply=age < 0 ? 0 : Math.max(0, Math.sin(Math.min(1, age / .18) * Math.PI / 2) * Math.exp(-age * 2.2));
   part.energy = reply;
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
