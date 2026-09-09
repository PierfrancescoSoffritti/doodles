import { createReedFamily, reedFootprint, reedLocalPoint, reedWorldPoint, REED_FAMILY_CAP, REED_FAMILY_SEPARATION, REED_WORLD_STEP_SECONDS, REED_WORLD_GRAZE_SECONDS, reedHabitat } from './ReedWalkerHabitat.js?v=world-3';
import { reedPose, reedPoseFits, REED_STRIDE_SECONDS } from './ReedWalkerMotion.js?v=world-2';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x); return x * x * x * (10 + x * (-15 + x * 6)); };
const lerp = (a, b, t) => a + (b - a) * t;
const angle = a => Math.atan2(Math.sin(a), Math.cos(a));

export function reedWorldStep(m, plan, time) {
 const t = clamp(time / REED_WORLD_STEP_SECONDS), blend = ease(t);
 const origin = { x: lerp(m.origin.x, plan.origin.x, blend), y: lerp(m.origin.y, plan.origin.y, blend), z: lerp(m.origin.z, plan.origin.z, blend) };
 const yaw = m.yaw + plan.turn * blend, pose = reedPose(m.traits, t * REED_STRIDE_SECONDS, 'step'); pose.body[0] = 0;
 const order = [2, 0, 3, 1];
 const feet = m.feet.map((from, i) => {
  const phase = clamp(t * 4 - order.indexOf(i)), f = ease(phase), to = plan.feet[i];
  return { x: lerp(from.x, to.x, f), y: lerp(from.y, to.y, f) + Math.sin(phase * Math.PI) ** 2 * .32 * m.scale, z: lerp(from.z, to.z, f) };
 });
 pose.feet = feet.map(f => reedLocalPoint(origin, yaw, f, m.scale));
 return { origin, yaw, pose, feet };
}
export class ReedWalkerWorldModel {
 constructor(seed, sites, sample, blocked = () => false) {
  this.seed = seed; this.sites = sites; this.sample = sample; this.blocked = blocked;
  this.groups = new Map(); this.rejected = new Set(); this.time = 0; this.onSound = () => {}; this.onRipple = () => {};
 }
 separated(site) {
  return [...this.groups.values()].every(g=>g.id===site.id||Math.hypot(g.site.x-site.x,g.site.z-site.z)>=REED_FAMILY_SEPARATION);
 }
 add(site) {
  if (this.groups.has(site.id)) return this.groups.get(site.id);
  if (this.rejected.has(site.id) || this.groups.size >= REED_FAMILY_CAP) return null;
  if (!this.separated(site)) return null;
  const group = createReedFamily(site, this.seed, this.sample, this.blocked);
  if (group) { this.groups.set(site.id, group); for (const m of group.members) { m.group = group; this.pose(m); } }
  else this.rejected.add(site.id);
  return group;
 }
 stream(position) {
  for (const [id, g] of this.groups) if (Math.hypot(g.site.x - position.x, g.site.z - position.z) > 650) this.groups.delete(id);
  const near = this.sites.filter(s => !this.groups.has(s.id) && !this.rejected.has(s.id) && this.separated(s) && Math.hypot(s.x - position.x, s.z - position.z) < 480)
   .sort((a,b) => Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z));
  for (const site of near.slice(0, 3)) { if (this.groups.size >= REED_FAMILY_CAP) break; this.add(site); }
 }
 findFamily(position, current) {
  const candidates = [...this.sites].filter(s => s.id !== current?.id && this.separated(s)).sort((a,b) => Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z));
  for (const site of candidates.slice(0, 160)) {
   if (this.rejected.has(site.id)) continue;
   const existing = this.groups.get(site.id); if (existing) return existing;
   const group = createReedFamily(site, this.seed, this.sample, this.blocked);
   if (!group) { this.rejected.add(site.id); continue; }
   // A deliberate field-guide journey can unload the distant old viewing area.
   if (this.groups.size >= REED_FAMILY_CAP) this.groups.delete(this.groups.keys().next().value);
   this.groups.set(site.id, group); for (const m of group.members) { m.group = group; this.pose(m); }
   return group;
  }
  return null;
 }
 plan(m, listener) {
  const away = Math.hypot(m.origin.x-listener.x,m.origin.z-listener.z)<10;
  const toHome = Math.hypot(m.origin.x-m.home.x,m.origin.z-m.home.z)>10;
  let turn = m.r.range(-.18,.18);
  if (away || toHome) {
   const dx = away ? m.origin.x-listener.x : m.home.x-m.origin.x, dz = away ? m.origin.z-listener.z : m.home.z-m.origin.z;
   turn = clamp(angle(-Math.atan2(dz,dx)-m.yaw),-.24,.24);
  }
  const stride=m.traits.stride*m.scale, pivot=turn<0?-.32:.32;
  for (const [distance,turnBy] of [[stride,turn],[stride*.6,turn],[0,pivot],[0,-pivot]]) {
   const yaw = m.yaw + turnBy;
   const origin = { x:m.origin.x+Math.cos(yaw)*distance,y:m.origin.y,z:m.origin.z-Math.sin(yaw)*distance };
   if (distance && m.group.members.some(o=>{
    if(o===m)return false;
    const positions=[o.draw?.origin||o.origin,...(o.state==='step'?[o.plan.origin]:[])];
    return positions.some(p=>Math.hypot(p.x-origin.x,p.z-origin.z)<Math.max(7,(o.scale+m.scale)*3.2)
     && Math.hypot(p.x-origin.x,p.z-origin.z)<=Math.hypot(p.x-m.origin.x,p.z-m.origin.z)+.1);
   })) continue;
   origin.y=this.sample(origin.x,origin.z).ground;
   const fit = reedFootprint(m.traits,origin,yaw,this.sample,this.blocked,m.bankWater); if (!fit) continue;
   const plan = {...fit,origin,turn:angle(yaw-m.yaw)};
   let supported=true;
   for (let t=0;t<=REED_WORLD_STEP_SECONDS;t+=.0625) {
    if (!reedPoseFits(m.traits,reedWorldStep(m,plan,t).pose)) {supported=false;break;}
   }
   if(supported)for(let i=0;i<=8;i++) {
    const draw=reedWorldStep(m,plan,i*REED_WORLD_STEP_SECONDS/8);
    if(!reedHabitat(this.sample(draw.origin.x,draw.origin.z),m.bankWater)||draw.feet.some(f=>{
     const at=this.sample(f.x,f.z);return at.roof||!Number.isFinite(at.ground)||at.ground<Math.max(at.water,m.bankWater)+.05||f.y<at.ground-.03;
    })){supported=false;break;}
   }
   if(!supported)continue;
   return plan;
  }
  return null;
 }
 pose(m) {
  if (m.state==='step') m.draw=reedWorldStep(m,m.plan,m.clock);
  else {
   const pose=reedPose(m.traits,m.state==='graze'?m.clock*38/REED_WORLD_GRAZE_SECONDS:m.clock,m.state);
   if(m.state==='stand') {
    const weight=Math.min(ease(m.clock/2),ease((m.rest-m.clock)/2));
    pose.body[0]*=weight;pose.body[2]*=weight;pose.body[1]=m.traits.legs+(pose.body[1]-m.traits.legs)*weight;
    pose.tilt=m.traits.tilt+(pose.tilt-m.traits.tilt)*weight;
   }
   pose.feet=m.feet.map(f=>reedLocalPoint(m.origin,m.yaw,f,m.scale));
   m.draw={origin:m.origin,yaw:m.yaw,pose,feet:m.feet};
  }
  m.position=reedWorldPoint(m.draw.origin,m.draw.yaw,m.draw.pose.body,m.scale);
 }
 update(dt, listener) {
  this.time+=dt;
  for(const group of this.groups.values()) for(const m of group.members) {
   m.clock+=dt/m.traits.patience;
   if(m.state==='graze'&&m.clock>=REED_WORLD_GRAZE_SECONDS) {m.state='stand';m.clock=0;m.rest=m.r.range(1.5,4);}
   else if(m.state==='stand'&&m.clock>=m.rest) {
    m.plan=this.plan(m,listener);m.state=m.plan?'step':'graze';m.clock=0;
   } else if(m.state==='step'&&m.clock>=REED_WORLD_STEP_SECONDS) {
    m.origin=m.plan.origin;m.yaw+=m.plan.turn;m.feet=m.plan.feet;m.traits=m.plan.traits;m.water=m.plan.water;m.feedingHeight=m.plan.feedingHeight;m.steps++;
    m.state=m.steps%6===0?'graze':'stand';m.clock=0;m.rest=m.r.range(.35,.8);
   }
   this.pose(m);
   m.nextCall-=dt;
   if(m.nextCall<=0) {this.onSound(m,m.draw.pose.feeding?'grazing':m.r.chance(.65)?'rumble':'breath');m.nextCall=m.r.range(18,36);}
   if(m.draw.pose.feeding && this.time>=(m.rippleAt||0)) {this.onRipple(m);m.rippleAt=this.time+2;}
  }
 }
}
