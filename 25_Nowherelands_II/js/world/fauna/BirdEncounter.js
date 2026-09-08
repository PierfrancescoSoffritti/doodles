import {BIRD_SPECIES} from './BirdSpecies.js?v=birds-10';
import {BirdJourney} from './BirdJourney.js?v=birds-10';
import {BirdForage} from './BirdForage.js?v=birds-10';

// Preserve the approved pose/wingbeat sequence, fitting its two contacts to
// real terrain and branch anchors. The body itself is uniformly scaled.
export class BirdEncounter {
 constructor(ground,perch,size=2.8,{species=0}={}){
  this.species=species;this.profile=BIRD_SPECIES[species];
  this.ground=ground;this.perch=perch;this.size=size;this.journey=new BirdJourney(this.profile);
  this.flights=0;this.restTime=0;this.pose=this.sample();
 }
 enableForaging(options={}){this.forage=new BirdForage(this.ground,{size:this.size,hopDuration:this.profile.hopDuration,waitScale:this.profile.waitScale,...options});return this;}
 start(){
  if(this.leg&&!this.journey.active)return this.travelTo(this.pose.state==='perched'?this.ground:this.perch,{ground:this.pose.state==='perched'});
  if(this.forage?.hop)return false;
  if(this.journey.start()){
   const yaw=Math.atan2(-(this.perch.z-this.ground.z),this.perch.x-this.ground.x)-Math.atan2(1,10);
   this.journey.startYaw=this.pose.yaw-yaw;
   for(const key of ['pitch','bank','headPitch','headYaw','fold','tail'])this.journey.startPose[key]=this.pose[key];
   this.flights++;this.restTime=0;return true;
  }return false;
 }
 travelTo(target,{ground=false}={}){
  if(this.journey.active||this.forage?.hop)return false;
  const old=this.pose,fromGround=old.state==='ground';
  const from=fromGround?{...this.ground}:{...this.perch};
  if(Math.hypot(target.x-from.x,target.z-from.z)<2)return false;
  this.leg={from,to:{...target},fromGround,toGround:ground};
  if(!ground)this.perch={...target};
  this.journey=new BirdJourney({...this.profile,fromGround,toGround:ground});this.journey.start();
  const yaw=Math.atan2(-(target.z-from.z),target.x-from.x)-Math.atan2(1,10);
  this.journey.startYaw=old.yaw-yaw;
  this.journey.startPose.position.y=(old.position.y-from.y)/this.size;
  for(const key of ['pitch','bank','headPitch','headYaw','fold','tail'])this.journey.startPose[key]=old[key];
  this.flights++;this.restTime=0;return true;
 }
 sample(){
  const pose=this.journey.sample(),g=this.leg?.from??this.ground,q=this.leg?.to??this.perch;
  const dx=q.x-g.x,dz=q.z-g.z,scale=Math.hypot(dx,dz)/Math.sqrt(101);
  const yaw=Math.atan2(-dz,dx)-Math.atan2(1,10),c=Math.cos(yaw),s=Math.sin(yaw);
  const x=pose.position.x+5,z=pose.position.z-1,u=(10*x-z)/101;
  const lift=Math.max(0,Math.min(1,(u-.02)/.55)),heightBlend=lift*lift*(3-2*lift);
  pose.position={x:g.x+(x*c+z*s)*scale,y:g.y+pose.position.y*this.size+(q.y-g.y-3*this.size)*heightBlend,z:g.z+(-x*s+z*c)*scale};
  pose.yaw+=yaw;pose.size=this.size;pose.species=this.species;return pose;
 }
 update(dt){
  const ground=!this.journey.active&&this.pose.state==='ground';
  if(this.forage){this.forage.update(dt,ground);this.ground={...this.forage.position};}
  if(this.leg){if(this.leg.fromGround)this.leg.from={...this.ground};if(this.leg.toGround)this.leg.to={...this.ground};}
  const previous=this.pose?.position,wasActive=this.journey.active;this.journey.update(dt);this.pose=this.sample();
  if(wasActive&&!this.journey.active&&this.pose.state==='ground'&&this.forage){this.forage.yaw=this.pose.yaw;this.forage.facing=this.pose.yaw;}
  if(!this.journey.active)this.restTime+=dt;
  this.pose.variant=this.variant ?? 0;
  if(ground&&this.forage)this.forage.pose(this.pose);
  if(previous&&dt>0&&['takeoff','flight','glide'].includes(this.pose.state)){
   const q=this.pose.position,vertical=q.y-previous.y,horizontal=Math.hypot(q.x-previous.x,q.z-previous.z);
   const pitch=Math.atan2(vertical,horizontal)*.65;
   if(horizontal>.005){const t=Math.max(0,Math.min(1,(this.journey.time-.28)/.12)),k=t*t*(3-2*t);this.pose.pitch+=(pitch-this.pose.pitch)*k;this.pose.headPitch+=(-pitch*.55-this.pose.headPitch)*k;}
  }
  return this.pose;
 }
}
