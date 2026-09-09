import { createReedFamily, reedFootprint, reedLocalPoint, reedWorldPoint, REED_FAMILY_CAP, REED_FAMILY_SEPARATION, REED_WORLD_STEP_SECONDS, REED_WORLD_GRAZE_SECONDS, reedHabitat, reedShallowFooting } from './ReedWalkerHabitat.js?v=graze-1';
import { reedPose, reedPoseFits, REED_STRIDE_SECONDS, REED_GRAZE_SECONDS } from './ReedWalkerMotion.js?v=graze-1';
import { reedSocialPose, socialEase, socialDistance } from './ReedWalkerSocial.js?v=graze-1';
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
  this.groups = new Map(); this.rejected = new Set(); this.time = 0; this.onSound = () => {}; this.onRipple = () => {}; this.socialEnabled = true;
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
  const intent = this.socialIntent(m), target = intent?.target;
  const away = Math.hypot(m.origin.x-listener.x,m.origin.z-listener.z)<10;
  const toHome = Math.hypot(m.origin.x-m.home.x,m.origin.z-m.home.z)>10;
  let turn = m.r.range(-.18,.18);
  if (target || away || toHome) {
   const dx = target ? target.x-m.origin.x : away ? m.origin.x-listener.x : m.home.x-m.origin.x, dz = target ? target.z-m.origin.z : away ? m.origin.z-listener.z : m.home.z-m.origin.z;
   turn = clamp(angle(-Math.atan2(dz,dx)-m.yaw),target ? -.42 : -.24,target ? .42 : .24);
  }
  const stride=Math.min(m.traits.stride*m.scale, target ? socialDistance(m.origin,target) : Infinity), pivot=turn<0?-.32:.32;
  for (const [distance,turnBy] of [[stride,turn],[stride*.6,turn],[0,pivot],[0,-pivot]]) {
   let yaw = m.yaw + turnBy;
   let origin = { x:m.origin.x+Math.cos(yaw)*distance,y:m.origin.y,z:m.origin.z-Math.sin(yaw)*distance };
   // A final short sideways step lets a youngster settle beside a parent.
   if (target && distance && socialDistance(m.origin,target) <= stride + .01) {
    origin = {...target, y:m.origin.y};
    if(intent.yaw !== undefined) yaw = m.yaw + clamp(angle(intent.yaw-m.yaw),-.42,.42);
   }
   if (distance && m.group.members.some(o=>{
    if(o===m)return false;
    const positions=[o.draw?.origin||o.origin,...(o.state==='step'?[o.plan.origin]:[])];
    return positions.some(p=>Math.hypot(p.x-origin.x,p.z-origin.z)<(intent?.partner===o ? intent.clearance : Math.max(7,(o.scale+m.scale)*3.2))
     && Math.hypot(p.x-origin.x,p.z-origin.z)<=Math.hypot(p.x-m.origin.x,p.z-m.origin.z)+.1);
   })) continue;
   origin.y=this.sample(origin.x,origin.z).ground;
   const fit = reedFootprint(m.traits,origin,yaw,this.sample,this.blocked,m.bankWater); if (!fit) continue;
   const plan = {...fit,origin,turn:angle(yaw-m.yaw)};
   let supported=true;
   for (let t=0;t<=REED_WORLD_STEP_SECONDS;t+=.0625) {
    if (!reedPoseFits(m.traits,reedWorldStep(m,plan,t).pose)) {supported=false;break;}
   }
   if(supported)for(let i=0;i<=40;i++) {
    const draw=reedWorldStep(m,plan,i*REED_WORLD_STEP_SECONDS/40);
    if(!reedHabitat(this.sample(draw.origin.x,draw.origin.z),.03)||this.blocked(draw.origin.x,draw.origin.z,3*m.scale,this.sample(draw.origin.x,draw.origin.z).ground)||draw.feet.some(f=>{
     const at=this.sample(f.x,f.z);return !reedShallowFooting(at,m.bankWater,.08)||f.y<at.ground-.03;
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
   let pose=reedPose(m.traits,m.state==='graze'?m.clock*REED_GRAZE_SECONDS/REED_WORLD_GRAZE_SECONDS:m.clock,m.state);
   if(m.state==='stand') {
    const weight=Math.min(ease(m.clock/2),Math.max(ease((m.rest-m.clock)/2),this.socialHeld(m)?socialEase(m.group.moment.elapsed/2):0));
    pose.body[0]*=weight;pose.body[2]*=weight;pose.body[1]=m.traits.legs+(pose.body[1]-m.traits.legs)*weight;
    pose.tilt=m.traits.tilt+(pose.tilt-m.traits.tilt)*weight;
   }
   pose.feet=m.feet.map(f=>reedLocalPoint(m.origin,m.yaw,f,m.scale));
   const moment=m.group?.moment;
   if(moment && m.state==='stand') {
    const kind=moment.phase==='distracted' && moment.child===m ? 'distracted' : moment.phase==='lean' && moment.child===m ? 'lean' : moment.phase==='lean' && moment.parent===m ? 'receive' : null;
    if(kind) {
     const other=m===moment.child?moment.parent:moment.child;
     const local=reedLocalPoint(m.origin,m.yaw,other.origin,1),length=Math.hypot(local[0],local[2])||1;
     const duration=kind==='distracted'?9:12;
     const weight=Math.min(socialEase(moment.clock/2.5),socialEase((duration-moment.clock)/3));
     pose=reedSocialPose(m.traits,pose,kind,moment.clock,weight,[local[0]/length,local[2]/length]);
    }
   }
   m.draw={origin:m.origin,yaw:m.yaw,pose,feet:m.feet};
  }
  m.position=reedWorldPoint(m.draw.origin,m.draw.yaw,m.draw.pose.body,m.scale);
 }
 socialHeld(m) {
  const s=m.group?.moment;
  return s && (s.child===m&&(s.phase==='distracted'||s.phase==='lean') || s.parent===m&&s.kind==='lean');
 }
 socialIntent(m) {
  const s=m.group?.moment;
  if(!s||s.child!==m)return null;
  if(s.phase==='catchup') {
   const p=s.parent.draw?.origin||s.parent.origin, dx=m.origin.x-p.x,dz=m.origin.z-p.z,d=Math.hypot(dx,dz)||1;
   const gap=Math.max(7.5,(m.scale+s.parent.scale)*3.3);
   return {target:{x:p.x+dx/d*gap,z:p.z+dz/d*gap}};
  }
  return s.phase==='approach'?{target:s.target,yaw:s.parent.yaw,partner:s.parent,clearance:s.clearance}:null;
 }
 beginSocial(group,kind,child,parent) {
  if(group.moment || child.traits.age!=='young' || parent.traits.age==='young' || child.state!=='stand' || kind==='lean'&&parent.state!=='stand')return false;
  let target,clearance;
  if(kind==='lean') {
   // Tuck beside the middle of the parent's flank, between its front and rear legs.
   const gap=parent.traits.width*parent.scale+child.traits.width*child.scale+.65;
   const candidates=[-1,1].map(side=>reedWorldPoint(parent.origin,parent.yaw,[0,0,side*gap],1)).sort((a,b)=>socialDistance(a,child.origin)-socialDistance(b,child.origin));
   target=candidates.find(p=>{
    p.y=this.sample(p.x,p.z).ground;
    return socialDistance(p,child.origin)<24 && reedFootprint(child.traits,p,parent.yaw,this.sample,this.blocked,child.bankWater)
     && group.members.every(m=>m===parent||m===child||socialDistance(m.origin,p)>7);
   });
   if(!target)return false;
   clearance=gap-.12;
  }
  group.moment={kind,phase:kind==='lean'?'approach':'distracted',clock:0,elapsed:0,child,parent,target,clearance};
  child.rest=child.clock+2.5;
  return true;
 }
 endSocial(group) {
  const s=group.moment;
  s.child.home={...s.child.origin};
  for(const m of [s.child,s.parent]) if(m.state==='stand')m.rest=m.clock+2;
  group.lastMoment=s.kind;group.moment=null;group.nextMoment=this.time+s.child.r.range(30,55);
 }
 updateSocial(group,dt) {
  const s=group.moment;
  if(!s) {
   if(!this.socialEnabled)return;
   group.nextMoment??=this.time+18+group.seed%19;
   if(this.time<group.nextMoment)return;
   const children=group.members.filter(m=>m.traits.age==='young'&&m.state==='stand');
   const child=children[(group.socialCount||0)%Math.max(1,children.length)];
   if(!child)return;
   const kind=group.lastMoment==='catchup'?'lean':'catchup';
   const parent=group.members.filter(m=>m.traits.age!=='young'&&(kind!=='lean'||m.state==='stand')).sort((a,b)=>socialDistance(a.origin,child.origin)-socialDistance(b.origin,child.origin))[0];
   if(parent&&this.beginSocial(group,kind,child,parent))group.socialCount=(group.socialCount||0)+1;
   else group.nextMoment=this.time+3;
   return;
  }
  s.clock+=dt;s.elapsed+=dt;
  if(s.phase==='distracted'&&s.clock>=9){s.phase='catchup';s.clock=0;s.child.rest=s.child.clock+1.5;}
  else if(s.phase==='catchup'&&s.child.state==='stand'&&socialDistance(s.child.origin,s.parent.draw?.origin||s.parent.origin)<=Math.max(8,(s.child.scale+s.parent.scale)*3.4))this.endSocial(group);
  else if(s.phase==='approach'&&s.child.state==='stand'&&socialDistance(s.child.origin,s.target)<.15){s.phase='lean';s.clock=0;}
  else if(s.phase==='lean'&&s.clock>=12)this.endSocial(group);
  // A blocked shoreline is not an invitation to teleport or cross deep water.
  else if(s.elapsed>55&&s.phase!=='lean'&&s.child.state!=='step')this.endSocial(group);
 }
 update(dt, listener) {
  this.time+=dt;
  for(const group of this.groups.values()) {
   this.updateSocial(group,dt);
   for(const m of group.members) {
   m.clock+=dt/m.traits.patience*(group.moment?.child===m&&group.moment.phase==='catchup'&&m.state==='step'?1.6:1);
   if(m.state==='graze'&&m.clock>=REED_WORLD_GRAZE_SECONDS) {m.state='stand';m.clock=0;m.rest=m.r.range(1.5,4);}
   else if(m.state==='stand'&&m.clock>=m.rest&&!this.socialHeld(m)) {
    m.plan=this.plan(m,listener);m.state=m.plan?'step':this.socialIntent(m)?'stand':'graze';m.clock=0; if(!m.plan)m.rest=1;
   } else if(m.state==='step'&&m.clock>=REED_WORLD_STEP_SECONDS) {
    m.origin=m.plan.origin;m.yaw+=m.plan.turn;m.feet=m.plan.feet;m.traits=m.plan.traits;m.water=m.plan.water;m.feedingHeight=m.plan.feedingHeight;m.steps++;
    m.state=m.steps%6===0&&!this.socialIntent(m)?'graze':'stand';m.clock=0;m.rest=this.socialIntent(m) ? .15 : m.r.range(.35,.8);
   }
   this.pose(m);
   m.nextCall-=dt;
   if(m.nextCall<=0) {this.onSound(m,m.r.chance(.65)?'rumble':'breath');m.nextCall=m.r.range(18,36);}
   if(m.draw.pose.feeding && this.time>=(m.rippleAt||0)) {this.onRipple(m);m.rippleAt=this.time+2;}
   }
  }
 }
}
