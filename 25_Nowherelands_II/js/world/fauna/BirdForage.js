// Little ballistic hops between feeding spots. Rest times and headings differ
// per bird; movement changes its actual ground anchor, not just its body pose.
export class BirdForage {
 constructor(home,{seed=1,size=2.8,hopDuration=.34,waitScale=1,sample=()=>home.y,valid=()=>true}={}){
  this.hopDuration=hopDuration;this.waitScale=waitScale;
  this.home={...home};this.position={...home};this.size=size;this.seed=seed;
  this.sample=sample;this.valid=valid;this.wait=.3+(seed%11)*.13;
  this.hop=null;this.height=0;this.yaw=null;this.hops=0;
 }
 answerHop(source,away=false){
  if(this.hop)return false;
  const dx=source.x-this.position.x,dz=source.z-this.position.z,angle=Math.atan2(dz,dx)+(away?Math.PI:0),distance=this.size*1.05;
  for(const offset of [0,.45,-.45]){
   const x=this.position.x+Math.cos(angle+offset)*distance,z=this.position.z+Math.sin(angle+offset)*distance,y=this.sample(x,z);
   if(Math.hypot(x-this.home.x,z-this.home.z)>this.size*2.5||!Number.isFinite(y)||Math.abs(y-this.position.y)>this.size*.25||!this.valid(x,y,z))continue;
   this.hop={startYaw:this.facing,from:{...this.position},to:{x,y,z},time:0,duration:this.hopDuration};this.yaw=Math.atan2(-(z-this.position.z),x-this.position.x);this.wait=5;return true;
  }return false;
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 update(dt,enabled=true){
  if(!enabled&&!this.hop)return;
  if(!this.hop){
   this.wait-=dt;if(this.wait>0)return;
   const a=this.random()*Math.PI*2,d=(.65+this.random()*.6)*this.size;
   const x=this.position.x+Math.cos(a)*d,z=this.position.z+Math.sin(a)*d,y=this.sample(x,z);
   this.wait=(.7+this.random()*1.5)*this.waitScale;
   if(Math.hypot(x-this.home.x,z-this.home.z)>this.size*2.5||!Number.isFinite(y)||Math.abs(y-this.position.y)>this.size*.25||!this.valid(x,y,z))return;
   this.hop={startYaw:this.facing,from:{...this.position},to:{x,y,z},time:0,duration:this.hopDuration};this.yaw=Math.atan2(-(z-this.position.z),x-this.position.x);
  }
  const h=this.hop;h.time=Math.min(h.duration,h.time+dt);const t=h.time/h.duration;
  for(const axis of ['x','y','z'])this.position[axis]=h.from[axis]+(h.to[axis]-h.from[axis])*t;
  this.height=4*t*(1-t)*this.size*.38;
  if(t===1){this.hop=null;this.height=0;this.hops++;}
 }
 pose(p){
  if(this.yaw!==null){
   const from=this.hop?.startYaw??this.yaw,t=Math.min(1,(this.hop?.time??1)/.12),k=t*t*(3-2*t);
   p.yaw=from+Math.atan2(Math.sin(this.yaw-from),Math.cos(this.yaw-from))*k;
  }
  this.facing=p.yaw;
  if(!this.hop)return p;
  const t=this.hop.time/this.hop.duration;
  p.position.y+=this.height;p.contact=0;p.legs=1-Math.sin(Math.PI*t)*.75;
  p.fold=.9;p.pitch=.1+.14*Math.sin(Math.PI*t);p.headPitch=-p.pitch*.5;p.activity='hop';
  return p;
 }
}
