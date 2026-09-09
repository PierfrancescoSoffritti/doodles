import { Random } from '../../core/Random.js';
import { reedPose, REED_GRAZE_TIMING } from './ReedWalkerMotion.js?v=graze-1';
import { reedSprayProfile, reedReleasePose, reedReleaseState } from './ReedWalkerDrink.js?v=world-spray-1';
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};

export function reedWorldSprayPose(traits,release,time=release.time) {
 const elapsed=Math.max(0,time-release.profile.braceAt),rest=reedPose(traits,elapsed,'stand'),w=ease(elapsed);
 const base={...rest,feet:release.basePose.feet,body:release.basePose.body.map((v,i)=>v+(rest.body[i]-v)*w),tilt:release.basePose.tilt+(rest.tilt-release.basePose.tilt)*w};
 return reedReleasePose(traits,base,time,release.profile);
}

export function updateReedReservoir(m,now,dt) {
 const r=m.reservoir??={load:0,readyAt:Infinity,nextAt:0,serial:0,random:new Random(`reed-water:${m.traits.seed}`),profile:reedSprayProfile(m.traits)};
 if(m.release){
  m.release.time+=dt/m.traits.patience;
  r.load=reedReleaseState(m.release.time,m.release.profile).remaining;
  if(m.release.time>=m.release.profile.duration){m.release=null;r.load=0;r.readyAt=Infinity;r.nextAt=now+r.random.range(30,55);m.rest=m.clock+2;}
  return;
 }
 if(m.state==='graze'){
  r.load=Math.max(r.load,ease((m.clock-REED_GRAZE_TIMING.lower)/REED_GRAZE_TIMING.feed));
  if(r.load>=.99&&!Number.isFinite(r.readyAt))r.readyAt=now+r.random.range(8,22);
 }
 const social=m.group?.moment,occupied=social&&(social.child===m||social.parent===m);
 // Wait for a supported pause, and allow only one spraying animal per family.
 if(r.load>=.99&&now>=Math.max(r.readyAt,r.nextAt)&&m.state==='stand'&&m.clock>=1&&!occupied&&!m.group.members.some(o=>o.release)){
  m.release={id:++r.serial,time:r.profile.braceAt,profile:r.profile,basePose:{...m.draw.pose,body:[...m.draw.pose.body],feet:m.draw.pose.feet.map(f=>[...f])}};
  m.clock=0;m.rest=r.profile.duration-r.profile.braceAt+2;
 }
}
