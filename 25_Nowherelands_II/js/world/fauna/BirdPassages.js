import {SpriteBirds} from './SpriteBirds.js?v=birds-9';
export const SKY_BIRD_CAPACITY=64;
export const SKY_LANE_SPACING=128;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const TAU=Math.PI*2;
const profiles=[
 {size:1.03,rate:1.85,glide:5.8,sink:-1.35,power:2.5,speed:1},
 {size:1.23,rate:1.45,glide:7.5,sink:-1.0,power:2.8,speed:.95},
 {size:.85,rate:2.25,glide:4.3,sink:-1.6,power:2.1,speed:1.03},
];

// A tangent entry, one or two complete turns, then a tangent exit. Circling
// occupies the same reserved lane as the approach and departure.
export function passagePoint(r,travel,offset=0){
 let along=travel,side=0,angle=0;
 if(r.circle){
  side=-r.radius;
  if(travel>=r.enter&&travel<r.enter+r.orbitLength){
   angle=(travel-r.enter)/r.radius;along=r.enter+r.radius*Math.sin(angle);side=-r.radius*Math.cos(angle);
  }else if(travel>=r.enter+r.orbitLength)along-=r.orbitLength;
 }
 // A tiny formation offset follows the local normal, including in the orbit.
 along-=Math.sin(angle)*offset;side+=Math.cos(angle)*offset;
 return {x:r.start.x+r.dx*along-r.dz*side,z:r.start.z+r.dz*along+r.dx*side,heading:r.heading+angle};
}

export class BirdPassages extends SpriteBirds {
 constructor({seed=7831,ground=()=>0,corridorOffset=45}={}){
  super();this.seed=seed;this.initialSeed=seed;this.ground=ground;this.corridorOffset=corridorOffset;
  this.heading=-.12-(seed%17)*.007;
 }
 reset(){
  super.reset();this.seed=this.initialSeed ?? 7831;this.birds=[];this.serial=0;
  this.arrivals=0;this.departures=0;this.nextArrival=0;this.laneOrigin=null;
  this.observer={x:0,y:0,z:0};
 }
 setObserver(p){this.observer={x:p.x,y:p.y,z:p.z};}
 spawn(first=false){
  const dx=Math.cos(this.heading),dz=Math.sin(this.heading),p=this.observer;
  const across=-dz*p.x+dx*p.z,along=dx*p.x+dz*p.z;
  this.laneOrigin ??= across-this.corridorOffset;
  const nearest=Math.round((across-this.corridorOffset-this.laneOrigin)/SKY_LANE_SPACING);
  const occupied=new Set(this.birds.map(b=>b.route.lane));
  const lane=[nearest,nearest-1,nearest-2,nearest-3].find(n=>!occupied.has(n));
  // Reserve the whole lane until the last member departs. New flocks cannot
  // intersect another group's path, even when the observer walks elsewhere.
  if(lane===undefined){this.nextArrival=this.time+1;return false;}
  const cross=this.laneOrigin+lane*SKY_LANE_SPACING;
  const circle=lane<nearest&&this.arrivals%3===1,radius=38;
  const orbitLength=circle?TAU*radius*(this.arrivals%2?1:2):0;
  const route={lane,heading:this.heading,dx,dz,start:{x:dx*(along-300)-dz*cross,z:dz*(along-300)+dx*cross},circle,radius,enter:260,orbitLength,length:600+orbitLength};
  let base=-Infinity;
  for(let s=0;s<=route.length+12;s+=12)for(const width of [-30,0,30]){
   const q=passagePoint(route,Math.min(s,route.length),width);base=Math.max(base,this.ground(q.x,q.z));
  }
  route.base=base+58+this.random()*14;
  const templates=new SpriteBirds().birds,count=10+Math.floor(this.random()*6),type=this.arrivals%3;
  for(let i=0;i<count;i++){
   const b=templates[i],kind=i%7===6?(type+1)%3:type,profile=profiles[kind];
   const travel=(first?205:0)-i*4,offset=(i%2?1:-1)*(circle?2+Math.floor(i/2)*.5:3+Math.floor(i/2)*3);
   const q=passagePoint(route,travel,offset),size=profile.size*(.9+this.random()*.2);
   Object.assign(b,{id:this.serial++,group:this.arrivals,route,travel,offset,heading:q.heading,base:route.base+(i%3)*1.8,turn:0,opacity:0,
    variant:kind,size,tint:.85+this.random()*.3,flapRate:profile.rate*(.92+this.random()*.16),glideDuration:profile.glide,glideSink:profile.sink,powerDuration:profile.power,speedScale:profile.speed,pattern:'passage'});
   b.p={x:q.x,y:b.base,z:q.z};b.speed*=profile.speed;b.v.x=dx*b.speed;b.v.z=dz*b.speed;this.birds.push(b);
  }
  this.arrivals++;this.nextArrival=this.time+10+this.random()*7;return true;
 }
 direction(b,snapshot){
  const q=passagePoint(b.route,b.travel+12,b.offset);
  let tx=q.x-b.p.x,tz=q.z-b.p.z;
  for(const o of snapshot){if(o.id===b.id)continue;const x=b.p.x-o.x,z=b.p.z-o.z,d=Math.hypot(x,z);if(d<5&&d>.001){tx+=x/d*(5-d)*.8;tz+=z/d*(5-d)*.8;}}
  return Math.atan2(tz,tx)+b.wander*.15;
 }
 step(dt){
  if(this.time>=this.nextArrival&&this.birds.length<=SKY_BIRD_CAPACITY-15)this.spawn(this.arrivals===0);
  super.step(dt);
  this.birds=this.birds.filter(b=>{
   const r=b.route;b.travel+=b.speed*dt;
   b.pattern=r.circle&&b.travel>=r.enter&&b.travel<r.enter+r.orbitLength?'circling':'passage';
   b.opacity=smooth(b.travel/35)*(1-smooth((b.travel-r.length+50)/50));
   if(b.travel>r.length+5){this.departures++;return false;}return true;
  });
 }
}
