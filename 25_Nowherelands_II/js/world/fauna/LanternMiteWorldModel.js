import { LanternMiteStudy } from './LanternMiteStudy.js?v=pebble-voice-4b';
import { lanternRestingFloor } from './LanternMiteHome.js';

export class LanternMiteColony {
 constructor(site) {
  this.site = site; this.id = site.id; this.model = new LanternMiteStudy(site.seed); this.lastPlayer = null;
  this.lastAlarm = -1; this.lastTime = 0; this.seen = new Set(); this.onSound = () => {}; this.onAlarm = () => {};
  for (const m of this.model.mites) {
   if (site.home) { m.perch = {...site.home.perches[m.id]}; m.refuge = {...site.home.refuges[m.id]}; }
   else { m.perch.z = 0; m.refuge.z = 0; m.refuge.y = Math.max(0.12, m.perch.y - 0.2); }
   m.pos = { ...m.perch }; m.target = { ...m.perch };
  }
 }
 hearNote(note) {
  const p=note.position,s=this.site,origin=s.point({x:0,y:0,z:0});
  if(!p||!['player-note','lantern-player','monolith','octahedron'].includes(note.layer)||(note.layer!=='player-note'&&Math.abs(p.y-s.center.y)>22))return false;
  const dx=(p.x-origin.x)/s.scale,dz=(p.z-origin.z)/s.scale;
  if(note.layer==='player-note')return this.model.answerPlayer({...note,radius:note.radius===undefined?undefined:note.radius/s.scale,position:{x:dx*s.tangent.x+dz*s.tangent.z,y:(p.y-s.base)/s.scale,z:dx*s.normal.x+dz*s.normal.z}},110/s.scale);
  return this.model.hearNote({x:dx*s.tangent.x+dz*s.tangent.z,y:(p.y-s.base)/s.scale,z:dx*s.normal.x+dz*s.normal.z},note.velocity);
 }
 update(dt, player, { active = true, sheltered = false } = {}) {
  const s = this.site, anchor = s.point({ x: 0, y: 0.75, z: 0 });
  const dx = player.x - anchor.x, dz = player.z - anchor.z;
  const speed = this.lastPlayer && dt > 0 ? Math.hypot(player.x - this.lastPlayer.x, player.z - this.lastPlayer.z) / dt : 0;
  const local = { x: (dx * s.tangent.x + dz * s.tangent.z) / s.scale,
   y: (player.y - s.base) / s.scale, z: (dx * s.normal.x + dz * s.normal.z) / s.scale };
  const nearGround = Math.abs(player.y - s.center.y) < 22;
  const exposed = active && nearGround && local.z > -0.4;
  this.model.externalVisitor = { position: local, speed: speed / s.scale, active: exposed };
  this.model.shelter(sheltered);
  const d = Math.hypot(local.x, local.z);
  // Teleports and observation-camera moves must not create an alarm.
  if (exposed && speed < 250 && speed > 0.5 && ((d < 3.8 && speed > 55) || d < 1.65) && this.model.time > this.model.alarmUntil) {
   Object.assign(this.model.visitor, local); this.model.startle();
  }
  this.model.update(dt);
  if (this.model.alarmUntil !== this.lastAlarm) { this.onAlarm(this.id); this.lastAlarm = this.model.alarmUntil; }
  for (const event of this.model.events) {
   const key = `${event.id}:${event.time}:${event.reply}`;
   if (!this.seen.has(key) && !sheltered && event.time >= this.lastTime) {
    const m = this.model.mites[event.id];
    this.onSound({ ...m, pos: this.position(m), colonyId: this.id }, event.reply);
   }
   this.seen.add(key);
  }
  this.seen = new Set(this.model.events.map(e => `${e.id}:${e.time}:${e.reply}`));
  this.lastTime = this.model.time; this.lastPlayer = { ...player };
 }
 position(m) {
  if (!this.site.home) return this.site.point(m.pos, m.size*this.site.scale);
  const floor=lanternRestingFloor(this.site.home,m.pos.x,m.pos.z,this.model.mites.map(m=>m.size),m.size);
  return {...this.site.point({...m.pos,y:Math.max(m.pos.y,floor+m.size)}),minY:this.site.base+(floor+m.size)*this.site.scale};
 }
}
