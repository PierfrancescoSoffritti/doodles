import { Random } from '../../core/Random.js';
import { reedPose, reedPoseFits, REED_GRAZE_SECONDS, REED_GRAZE_TIMING } from './ReedWalkerMotion.js?v=graze-1';
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};

export function reedSprayProfile(traits) {
 const r=new Random(`reed-reservoir:${traits.seed}`), young=traits.age==='young';
 const braceAt=REED_GRAZE_SECONDS+r.range(3.5,6.5), sprayAt=braceAt+1;
 const bursts=young?[{at:sprayAt,duration:.4,power:6.3},{at:sprayAt+r.range(.8,1.2),duration:.24,power:4.8}]
  :[{at:sprayAt,duration:r.range(1.15,1.5),power:r.range(9.2,10.5)}];
 return {braceAt,sprayAt,bursts,duration:bursts.at(-1).at+bursts.at(-1).duration+5};
}

// A complete, seekable study: drink once, carry the reservoir, brace and empty it.
// The world reuses the release pose after carrying water through its own routine.
export function reedDrinkPose(traits,time,profile=reedSprayProfile(traits)) {
 const t=Math.max(0,time), riseEnd=REED_GRAZE_SECONDS-REED_GRAZE_TIMING.rest;
 let pose=reedPose(traits,Math.min(t,riseEnd),'graze');
 if(t>riseEnd){
  const rest=reedPose(traits,t-riseEnd,'stand'),w=ease((t-riseEnd)/2);
  pose={...rest,body:pose.body.map((v,i)=>v+(rest.body[i]-v)*w),tilt:pose.tilt+(rest.tilt-pose.tilt)*w};
 }
 const filled=ease((t-REED_GRAZE_TIMING.lower)/REED_GRAZE_TIMING.feed);
 const {end}=reedReleaseState(t,profile);
 pose=reedReleasePose(traits,pose,t,profile,filled);
 const stage=t<REED_GRAZE_TIMING.lower?'Lowering to drink':t<6.5?'Drinking · the reservoir fills':t<riseEnd?'Rising with the water':t<profile.braceAt?'Carrying water · in no hurry':t<profile.sprayAt?'Bracing for a breath':t<end?(traits.age==='young'?'An uneven little spurt · and another':'A broad spray from the dorsal seam'):t<profile.duration?'Droplets falling back over the shell':'Empty again · settled and resting';
 return {...pose,stage,phase:t<riseEnd?'drink':t<profile.braceAt?'hold':t<profile.sprayAt?'brace':t<end?'spray':t<profile.duration?'rain':'complete'};
}

export function reedReleaseState(t,profile) {
 const released=profile.bursts.reduce((sum,b)=>sum+ease((t-b.at)/b.duration),0)/profile.bursts.length;
 const end=profile.bursts.at(-1).at+profile.bursts.at(-1).duration;
 const brace=ease(t-profile.braceAt)*(1-ease((t-end)/1.5));
 const recoil=profile.bursts.reduce((sum,b)=>{const age=t-b.at;return sum+(age>0&&age<.8?Math.sin(age/.8*Math.PI)*Math.exp(-age*3):0);},0);
 return {remaining:1-released,end,brace,recoil};
}

export function reedReleasePose(traits,pose,t,profile,filled=1) {
 const {remaining,brace,recoil}=reedReleaseState(t,profile);
 const make=w=>({...pose,body:[pose.body[0],pose.body[1]+(-.19*brace+.10*recoil)*w,pose.body[2]],tilt:pose.tilt+(-.035*brace+.025*recoil)*w});
 let weight=1;for(let i=0;i<12&&!reedPoseFits(traits,make(weight));i++)weight*=.7;
 return {...make(weight),waterLoad:filled*remaining,spray:clamp(recoil*2)};
}

export function reedSprayDrops(traits,profile=reedSprayProfile(traits)) {
 const r=new Random(`reed-droplets:${traits.seed}`),drops=[];
 for(const burst of profile.bursts){
  const count=traits.age==='young'?70:280;
  for(let i=0;i<count;i++){
   const a=r.range(0,Math.PI*2),spread=r.range(.18,2.5);
   drops.push({at:burst.at+i/count*burst.duration,vx:Math.cos(a)*spread,vz:Math.sin(a)*spread,vy:burst.power*r.range(.72,1.05),size:r.range(.022,.055),length:r.range(1.8,3.4),shade:r.range(.75,1)});
  }
 }
 return drops;
}

// Ballistic water, with a small outward deflection when it lands back on the husk.
export function reedDropPoint(drop,age,traits) {
 if(age<0)return null;
 const gravity=9.8,backAt=2*drop.vy/gravity;
 let x=drop.vx*age,y=drop.vy*age-gravity*age*age/2,z=drop.vz*age;
 let vx=drop.vx,vy=drop.vy-gravity*age,vz=drop.vz;
 if(age>backAt&&Math.abs(drop.vx*backAt)<traits.length*.8&&Math.abs(drop.vz*backAt)<traits.width*.8){
  const after=age-backAt,n=Math.hypot(drop.vx,drop.vz)||1;
  vx=drop.vx/n*2.1;vz=drop.vz/n*2.1;vy=.55-gravity*after;
  x=drop.vx*backAt+vx*after;z=drop.vz*backAt+vz*after;y=.55*after-gravity*after*after/2;
 }
 return {x,y,z,vx,vy,vz};
}
