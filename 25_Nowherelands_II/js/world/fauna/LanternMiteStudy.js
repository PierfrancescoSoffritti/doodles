import { receiveNote, updateNote } from './NoteResponse.js?v=player-notes-13';
import { Random } from '../../core/Random.js';
import { lanternLight } from '../../audio/LanternMiteVoice.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const point = (x, y, z) => ({ x, y, z });
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// A bounded character fixture. Habitat streaming and world navigation come later.
export class LanternMiteStudy {
 constructor(seed = 'root-hollow') { this.seed = seed; this.reset(); }

 reset() {
  const random = new Random(this.seed);
  this.time = 0; this.quiet = 0; this.alarmUntil = 0; this.events = [];
  this.wasNearby = false; this.nextSocial = 3.5; this.socialTurn = 0;
  this.externalVisitor = null; this.sheltered = false;
  this.navigate=null;this.homeExcursion=null;this.heardNotes=[];this.lastHeard=-100;this.noteTurn=0;
  this.visitor = point(0, 0.04, 7); this.destination = 7; this.visitorSpeed = 0;
  this.pace = 0.9; this.demo = false; this.demoIndex = 0;
  this.mites = Array.from({ length: 5 }, (_, i) => {
   const x = [-1.85, -0.8, 0.15, 1.12, 2.0][i];
   const perch = point(x, [0.62, 0.36, 0.45, 0.55, 0.35][i], [0.25, 0.62, 0.3, 0.42, 0.7][i]);
   return { id: i, bold: i === 2, size: random.range(0.105, 0.14), phase: random.range(0, Math.PI * 2),
    perch, refuge: point(x * 0.8, 0.22, -1.15 - i * 0.07), pos: { ...perch }, target: { ...perch },
    state: 'rest', since: 0, until: 0.15 + i * 0.33, brightness: 0.15,
    route: [], arrivedAt: Infinity, partner: null,
    pulseAt: -100, replyAt: Infinity, nextContact: 0, excursions: 0, contacts: 0, visitorContacts: 0,
    random: new Random(`${this.seed}:mite:${i}`) };
  });
 }

 command(action) {
  this.demo = false;
  if (action === 'approach') { this.destination = 3.8; this.pace = 0.9; }
  if (action === 'wait') this.destination = this.visitor.z;
  if (action === 'leave') { this.destination = 7; this.pace = 1.4; }
  if (action === 'startle') { this.destination = Math.max(2.7, this.visitor.z - 0.8); this.pace = 5; this.startle(); }
 }

 playEncounter() { this.reset(); this.demo = true; }

 transition(mite, state, target = mite.pos) {
  mite.state = state; mite.since = this.time; mite.target = { ...target }; mite.arrivedAt = Infinity;
  mite.waypoints=[];
  if(this.navigate&&distance(mite.pos,target)>0.08){
   const path=this.navigate(mite.pos,target);
   if(path.length){mite.target={...path[0]};mite.waypoints=path.slice(1);}
   else {mite.target={...mite.pos};mite.route=[];}
  }
 }

 forage(mite) {
  const r = mite.random;
  // Short, different journeys through the open air in front of the roots.
  // Two feeding stops give a trip a changing heading, rather than a fixed bob.
  mite.route = [
   point(clamp(mite.perch.x + r.range(-0.6, 0.6), -2.15, 2.15), r.range(0.85, 1.4), r.range(0.9, 1.6)),
   point(clamp(mite.perch.x + r.range(-0.85, 0.85), -2.15, 2.15), r.range(0.65, 1.15), r.range(0.8, 1.7)),
  ];
  if(this.homeExcursion)mite.route=this.homeExcursion(mite)||mite.route;
  mite.excursions++;
  this.transition(mite, 'forage', mite.route.shift());
 }

 rest(mite) {
  this.transition(mite, 'rest', mite.perch);
  mite.until = this.time + mite.random.range(0.65, 1.7);
 }

 visitNeighbor() {
  const available = this.mites.filter(m => ['rest', 'forage'].includes(m.state) && (!m.bold || this.visitorDistance() >= 6));
  if (available.length < 2) return;
  const caller = available[this.socialTurn % available.length];
  const neighbor = available.filter(m => m !== caller && distance(m.pos, caller.pos) < 2.2)
   .sort((a, b) => distance(a.pos, caller.pos) - distance(b.pos, caller.pos))[0];
  if (!neighbor) return;
  this.socialTurn++;
  // A neighbor rises to meet the visitor, keeping both bodies above the moss.
  const meeting = point(clamp(neighbor.pos.x, -2.15, 2.15), clamp(neighbor.pos.y, 0.85, 1.4), clamp(neighbor.pos.z, 0.95, 1.7));
  this.transition(neighbor, 'listen', meeting); neighbor.until = this.time + 5;
  this.transition(caller, 'visit', point(clamp(meeting.x + (caller.pos.x < meeting.x ? -0.42 : 0.42), -2.35, 2.35), meeting.y + 0.15, meeting.z + 0.22));
  caller.partner = neighbor.id;
  this.nextSocial = this.time + 7 + caller.random.range(0, 3);
 }

 visitorDistance() { return this.externalVisitor?.active === false ? Infinity : Math.hypot(this.visitor.x, this.visitor.z); }

 shelter(value) {
  if (value === this.sheltered) return;
  this.sheltered = value;
  if (value) this.startle(true); else this.alarmUntil = this.time + 2;
 }

 startle(force = false) {
  if (!force && this.visitorDistance() > 6) return;
  this.alarmUntil = this.time + 6; this.quiet = 0;
  this.nextSocial = this.alarmUntil + 5;
  this.events = [];
  for (const mite of this.mites) {
   mite.replyAt = Infinity; mite.pulseAt = -100;
   this.transition(mite, 'retreat', mite.refuge);
  }
 }

 answerPlayer(note,range=12) {
  if(this.sheltered||this.time<this.alarmUntil)return false;
  let heard=false;
  for(const m of this.mites)if(receiveNote(m,this.time,note,{delay:m.id*.22,range,duration:5}))heard=true;
  return heard;
 }

 hearNote(position,velocity=0.35) {
  if(this.sheltered||this.time<this.alarmUntil||Math.hypot(position.x,position.z)>10||position.z<0||this.time-this.lastHeard<0.12)return false;
  this.lastHeard=this.time;this.heardNotes=this.heardNotes.filter(t=>this.time-t<3);this.heardNotes.push(this.time);
  if(velocity>0.82||this.heardNotes.length>=3){this.startle(true);return true;}
  if(this.mites.some(m=>['orient','answering','note-rest'].includes(m.state)))return false;
  const choices=this.mites.filter(m=>!['hidden','retreat','emerge','contact'].includes(m.state));
  if(!choices.length)return false;
  const mite=choices[this.noteTurn++%choices.length];mite.replyAt=Infinity;
  mite.noteTarget=point(clamp(position.x*0.4,-1.8,1.8),clamp(position.y*0.45,1.25,2.3),clamp(position.z-1.5,2.3,4));
  this.transition(mite,'orient');this.nextSocial=Math.max(this.nextSocial,this.time+5);
  return true;
 }

 pulse(mite, reply = false, kind = 'social', responder = null) {
  mite.pulseAt = this.time; mite.pulseReply = reply; mite.contacts++;
  if (!reply && kind === 'visitor') mite.visitorContacts++;
  this.events.push({ time: this.time, id: mite.id, reply, kind });
  // Only an initiating call gets one answer. Replies cannot trigger a cascade.
  if (!reply) {
   const neighbor = this.mites[responder ?? (mite.id + 2) % this.mites.length];
   neighbor.replyAt = this.time + 1.25 + neighbor.id * 0.17;
   neighbor.replyKind = kind;
  }
 }

 update(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  // Keep callers on small steps, including tests or a delayed animation frame.
  let remaining = Math.min(dt, 1);
  while (remaining > 1e-8) { const step = Math.min(remaining, 1 / 60); this.step(step); remaining -= step; }
 }

 step(dt) {
  this.time += dt;
  if (this.demo) {
   const script = [[1, 'approach'], [8, 'wait'], [20, 'startle'], [29, 'leave']];
   if (this.demoIndex < script.length && this.time >= script[this.demoIndex][0]) {
    this.command(script[this.demoIndex++][1]); this.demo = true;
   }
   if (this.time >= 35) this.demo = false;
  }
  if (this.externalVisitor) {
   Object.assign(this.visitor, this.externalVisitor.position);
   this.visitorSpeed = this.externalVisitor.active === false ? 0 : this.externalVisitor.speed;
  } else {
   const delta = this.destination - this.visitor.z;
   const travel = Math.sign(delta) * Math.min(Math.abs(delta), this.pace * dt);
   this.visitor.z += travel; this.visitorSpeed = Math.abs(travel / dt);
  }
  this.quiet = this.visitorSpeed < 0.05 ? this.quiet + dt : 0;
  const nearby = this.visitorDistance() < 6;
  const disturbed = this.sheltered || this.time < this.alarmUntil;

  for (const mite of this.mites) {
   updateNote(mite,this.time,r=>{
    mite.replyAt=Infinity;
    if(r.alarm){this.startle(true);return;}
    const x=clamp(r.source.x*.35,-1.5,1.5),z=clamp(r.source.z-1.2,1.8,3.8),y=clamp(r.source.y*.5,1.4,2.5);
    mite.noteOrbit=Array.from({length:4},(_,i)=>point(x+Math.cos(i*Math.PI/2+mite.id)*.6,y+Math.sin(i*Math.PI/2)*.25,z+Math.sin(i*Math.PI/2+mite.id)*.6));
    this.transition(mite,'note-orbit',mite.noteOrbit.shift());this.nextSocial=this.time+8;
   },r=>this.onNoteSound?.(mite,r.alarm));
   if(mite.state==='note-orbit'&&!mite.noteResponse)this.transition(mite,'return',mite.perch);
   const age = this.time - mite.since;
   if(mite.waypoints?.length&&distance(mite.pos,mite.target)<0.06){mite.target=mite.waypoints.shift();mite.arrivedAt=Infinity;}
   const arrived = !mite.waypoints?.length&&distance(mite.pos, mite.target) < 0.035;
   if(mite.state==='note-orbit'&&arrived&&mite.noteOrbit.length)this.transition(mite,'note-orbit',mite.noteOrbit.shift());
   if (mite.state === 'retreat' && arrived) {
    this.transition(mite, 'hidden', mite.refuge);
   } else if (mite.state === 'hidden') {
    if (!disturbed && this.time > this.alarmUntil + mite.id * 0.65 && this.quiet > 3 + mite.id * 0.65 && age > 3.2 + mite.id * 0.6) {
     this.transition(mite, 'emerge', mite.perch);
    }
   } else if (mite.state === 'emerge' && arrived) {
    this.rest(mite);
   } else if (!['retreat', 'hidden', 'emerge'].includes(mite.state)) {
    if (nearby && (!this.wasNearby || this.visitorSpeed > 0.3)) {
     if (!['investigate', 'contact', 'return', 'notice','orient','answering','note-rest','note-orbit'].includes(mite.state)) this.transition(mite, 'notice');
    }
    if (nearby && mite.bold && ['notice', 'rest', 'forage'].includes(mite.state) && this.quiet > 3.8 && this.time > mite.nextContact) {
      this.transition(mite, 'investigate', point(clamp(this.visitor.x * 0.6 + 0.3, -2.15, 2.15), 1.05, clamp(this.visitor.z - 1.4, 0.6, 2.3)));
    } else if (['investigate', 'contact'].includes(mite.state) && (!nearby || this.visitorSpeed > 0.3)) {
      mite.nextContact = this.time + 6;
      this.transition(mite, 'return', mite.perch);
    } else if (['orient','answering','note-rest'].includes(mite.state)&&this.visitorDistance()>11) {
      this.transition(mite,'return',mite.perch);
    } else if (mite.state === 'orient' && age>0.65+mite.id*0.1) {
      this.transition(mite,'answering',mite.noteTarget);
    } else if (mite.state === 'answering' && arrived) {
      this.pulse(mite,true,'player-note');this.transition(mite,'note-rest');
    } else if (mite.state === 'note-rest' && age>1.6) {
      mite.nextContact=this.time+8;this.forage(mite);
    } else if (mite.state === 'investigate' && arrived) {
      this.transition(mite, 'contact'); this.pulse(mite, false, 'visitor');
    } else if (mite.state === 'contact' && age > 3.5) {
      mite.nextContact = this.time + 10;
      this.transition(mite, 'return', mite.perch);
    } else if (mite.state === 'notice' && (!nearby || this.quiet > 1.0 + mite.id * 0.12)) {
      this.forage(mite);
    } else if (mite.state === 'return' && arrived) {
      this.rest(mite);
    } else if (mite.state === 'rest' && this.time > mite.until && (!nearby || this.quiet > 1)) {
      this.forage(mite);
    } else if (mite.state === 'forage' && arrived) {
      if (!Number.isFinite(mite.arrivedAt)) mite.arrivedAt = this.time;
      if (this.time - mite.arrivedAt > (mite.target.hold ?? (0.3 + mite.id * 0.07))) {
       if (mite.route.length) this.transition(mite, 'forage', mite.route.shift());
       else this.transition(mite, 'return', mite.perch);
      }
    } else if (mite.state === 'visit' && arrived) {
      this.pulse(mite, false, 'social', mite.partner);
      this.transition(mite, 'exchange'); mite.until = this.time + 1.1;
    } else if (['listen', 'exchange'].includes(mite.state) && this.time > mite.until) {
      this.forage(mite);
    } else if (mite.state === 'visit' && age > 5) {
      this.transition(mite, 'return', mite.perch);
    }
   }

   if (this.time >= mite.replyAt) {
    mite.replyAt = Infinity;
    if (!disturbed && !['retreat', 'hidden'].includes(mite.state)) this.pulse(mite, true, mite.replyKind);
   }
   const d = distance(mite.pos, mite.target);
   const speed = mite.state === 'note-orbit' ? 2.4 : mite.state === 'retreat' ? 3.3 + mite.id * 0.18 : ['investigate','answering'].includes(mite.state) ? (this.homeExcursion?1.1:0.7) : (this.homeExcursion?1.5:0.9) + mite.id * 0.07;
   const amount = d > 0 ? Math.min(1, speed * dt / d, mite.waypoints?.length?1:1 - Math.exp(-3 * dt)) : 0;
   for (const key of ['x', 'y', 'z']) mite.pos[key] += (mite.target[key] - mite.pos[key]) * amount;

   const pulseAge = this.time - mite.pulseAt;
   const pulse = lanternLight(pulseAge, mite, mite.pulseReply);
   const base = { 'note-orbit':.4, rest: 0.13, forage: 0.3, visit: 0.44, listen: 0.3, exchange: 0.38, notice: 0.2, orient:0.46,answering:0.62,'note-rest':0.42,investigate: 0.64, contact: 0.48, return: 0.24, retreat: 0.012, hidden: 0.008, emerge: 0.12 }[mite.state];
   const light = base + pulse * 0.75 + (mite.noteGlow||0)*.3;
   mite.brightness += (light - mite.brightness) * (1 - Math.exp(-(disturbed ? 13 : pulseAge < 0.8 ? 28 : 3) * dt));
  }
  this.events = this.events.filter(event => this.time - event.time < 5);
  if (!disturbed && this.time > this.nextSocial && (!nearby || this.quiet > 2)) this.visitNeighbor();
  this.wasNearby = nearby;
 }

 get caption() {
  if (this.mites.some(m => m.state === 'retreat')) return ['Back to shelter', 'The lights dim. Each mite takes its own short route home.'];
  if (this.mites.every(m => m.state === 'hidden')) return ['A quiet hollow', 'They are still here. Give them a few undisturbed seconds.'];
  if (this.mites.some(m => m.state === 'emerge')) return ['One at a time', 'Faint lights return at different moments, close to the roots.'];
  if(this.mites.some(m=>m.state==='orient'))return ['Someone heard you','One light pauses and turns toward your note.'];
  if(this.mites.some(m=>m.state==='answering'))return ['Following the sound','One mite comes closer. Leave room for its reply.'];
  if(this.mites.some(m=>m.state==='note-rest'))return ['A small answer','A single soft note, then back to exploring the hollow.'];
  if (this.events.some(e => e.reply && e.kind === 'visitor')) return ['An answer from the roots', 'A delayed pulse. The others keep their distance.'];
  if (this.mites.some(m => m.state === 'contact')) return ['A little attention, freely given', 'The curious mite pauses and sends a soft contact pulse.'];
  if (this.mites.some(m => m.state === 'investigate')) return ['One comes closer', 'The boldest mite leaves its resting place. The colony stays behind.'];
  if (this.mites.some(m => ['visit', 'listen', 'exchange'].includes(m.state))) return ['A visit to a neighbor', 'Two lights meet briefly. The rest carry on browsing.'];
  if (this.visitorDistance() < 6) return ['Life goes on around you', this.visitorSpeed > 0.05 ? 'A brief pause as you approach. Stop and let the hollow settle.' : 'They resume their small journeys once you become familiar.'];
  return ['A busy little hollow', 'Drift, browse, greet a neighbor. A brief rest, then off again.'];
 }
}
