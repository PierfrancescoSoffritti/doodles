import { Random } from '../core/Random.js';

export const WATER_RADIUS = 6.8;
export const BED_Y = -1.8;
export const SCHOOL_COUNTS = {solo:[1],small:[4],medium:[9],large:[20],mixed:[1,4,15]};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));

// Renderer-independent, seeded study. All response times use simulation time.
export class WaterStudy {
 constructor({seed='stillwater',serial=1,species='pool',school='mixed'}={}) {
  this.seed=seed;this.serial=serial;this.species=species;this.school=SCHOOL_COUNTS[school]?school:'mixed';
  this.time=0;this.disturbedAt=-100;this.touchAt=-100;this.ripples=[];this.events=[];this.pending=[];
  this.fish=[];this.plants=[];this.status='Quiet water. Take a moment to look.';
  const rnd=new Random(`${seed}:water:${serial}`);
  if(species==='pool'||species==='scarlet-fish') SCHOOL_COUNTS[this.school].forEach((count,schoolIndex)=>{
   const phase=(schoolIndex*2.2+1.3)+rnd.range(-.2,.2),radius=count===1?2.1:count<=4?3.5:4.2;
   for(let i=0;i<count;i++)this.fish.push({school:schoolIndex,index:i,count,phase,orbit:radius,
    offset:(Math.floor(i/3)-Math.floor(count/3)/2)*.30,side:(i%3-1)*.72+rnd.range(-.12,.12),size:rnd.range(.44,.58),hue:rnd.range(-.012,.009),
    depth:rnd.range(-1.25,-.55),beat:rnd.range(0,6.28),x:0,y:-.8,z:0,yaw:0,speed:0});
  });
  if(species==='pool'||species==='light-lily') for(let i=0;i<3;i++)this.plants.push({
   x:[-2.8,.1,2.8][i],z:[-1.8,-2.7,-1.4][i],size:rnd.range(.8,1.1),phase:rnd.range(0,6.28),
   glow:0,open:.42,replyAt:-100,index:i,turn:rnd.range(-.4,.4)});
  this.update(0,true);
 }
 touch(x=0,z=0,strong=false) {
  if(!this.plants.length)return false;
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>WATER_RADIUS)return false;
  // Bounded phrases; no timers or replies retained across a specimen replacement.
  if(!strong&&this.time-this.touchAt<.7)return false;
  this.touchAt=this.time;this.ripples.push({x,z,born:this.time,strong});
  if(this.ripples.length>4)this.ripples.shift();
  this.pending=[];
  if(strong){this.disturbedAt=this.time;for(const p of this.plants)p.replyAt=-100;}
  else {
   for(const p of this.plants)this.pending.push({at:this.time+.2+Math.hypot(p.x-x,p.z-z)/3.2,index:p.index});
   this.pending.sort((a,b)=>a.at-b.at);
  }
  this.status=strong?'A splash: the flowers close a little, then settle.':'A ripple travels. The flowers answer one by one.';
  return true;
 }
 settle(){this.disturbedAt=-100;this.pending=[];this.ripples=[];this.touchAt=-100;for(const p of this.plants)p.replyAt=-100;this.status='Giving the pool time to settle.';}
 drainEvents(){return this.events.splice(0);}
 update(dt,initial=false) {
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);this.time+=dt;
  const t=this.time,since=t-this.disturbedAt,alarm=Math.exp(-Math.max(0,since)*.68);
  this.ripples=this.ripples.filter(r=>t-r.born<4);
  while(this.pending.length&&this.pending[0].at<=t){const e=this.pending.shift(),p=this.plants[e.index];p.replyAt=e.at;if(this.events.length<8)this.events.push({kind:'lily',plant:e.index,part:e.index});}
  for(const f of this.fish){
   const a=t*(f.count===1?.19:.14)+f.phase+f.offset;
   let x=Math.cos(a)*(f.orbit+f.side),z=Math.sin(a)*(f.orbit+f.side)*.78+Math.sin(a*2+f.beat)*.1;
   const radius=Math.hypot(x,z),limit=WATER_RADIUS-1.35;
   if(radius>limit){x*=limit/radius;z*=limit/radius;}
   if(initial){f.x=x;f.z=z;f.yaw=-a-Math.PI/2;}
   const oldX=f.x,oldZ=f.z;
   f.x=damp(f.x,x,2.5,dt);f.z=damp(f.z,z,2.5,dt);
   const vx=f.x-oldX,vz=f.z-oldZ;
   if(Math.hypot(vx,vz)>.00001){const target=Math.atan2(-vz,vx),delta=Math.atan2(Math.sin(target-f.yaw),Math.cos(target-f.yaw));f.yaw+=delta*(1-Math.exp(-dt*5));}
   f.speed=dt?Math.hypot(vx,vz)/dt:f.speed;
   f.y=clamp(f.depth+Math.sin(t*.8+f.beat)*.09,-1.35,-.48);
   f.stroke=Math.sin(t*5+f.beat)*.15;
  }
  for(const p of this.plants){const age=t-p.replyAt;p.glow=age>=0?Math.sin(Math.min(1,age/.25)*Math.PI/2)*Math.exp(-age*1.3):0;p.open=damp(p.open,.42+p.glow*.5-alarm*.18,4,dt);}
  if(t-this.touchAt>5)this.status=this.plants.length?'Still again. Quiet beneath the floating flowers.':'Fish cruise quietly, following their own routes.';
 }
}
