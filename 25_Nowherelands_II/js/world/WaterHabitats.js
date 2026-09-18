import { Random } from '../core/Random.js';
import { RIVER_STRIDE as S, RV } from './gen/Rivers.js';

const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const FISH_MIN_RADIUS=10;
export const LILY_PALETTES=[
 {petal:'#fff4d4',pad:'#7fae57',core:'#ffd16c'},
 {petal:'#ff8ab7',pad:'#467e73',core:'#ffe3a0'},
 {petal:'#c8b6ff',pad:'#528d8c',core:'#f9cfff'},
 {petal:'#ffb279',pad:'#8c9c45',core:'#fff1a0'},
 {petal:'#e5fcf0',pad:'#436d8a',core:'#93ffee'},
];
export function calmWater(s,level,min=.3,max=12){
 return Number.isFinite(s.ground)&&Number.isFinite(s.water)&&!s.roof&&s.foam<.12&&s.speed<.8&&
  Math.abs(s.water-level)<.12&&s.water-s.ground>=min&&s.water-s.ground<=max;
}
// A complete disk of open water, including room for the body beyond each route.
// Minimum diameter is 27 world units: small puddles never receive fish.
export function waterClearance(sample,x,z,radius,level){
 let depth=Infinity;
 const steps=Math.ceil(radius/2);
 for(let iz=-steps;iz<=steps;iz++)for(let ix=-steps;ix<=steps;ix++){
  const dx=ix/steps*radius,dz=iz/steps*radius;if(Math.hypot(dx,dz)>radius)continue;
  const s=sample(x+dx,z+dz);if(!calmWater(s,level,2.6,300))return 0;
  depth=Math.min(depth,s.water-s.ground);
 }
 for(let i=0;i<48;i++){const a=i/48*TAU,s=sample(x+Math.cos(a)*radius,z+Math.sin(a)*radius);if(!calmWater(s,level,2.6,300))return 0;depth=Math.min(depth,s.water-s.ground);}
 return depth;
}
export function waterSites(world,lakes,sample,seed,seaLevel=0){
 const candidates=[];
 for(const lake of lakes)for(const [i,s] of lake.shore.entries())candidates.push({id:`lake:${lake.id}:${i}`,x:s.x,z:s.z,nx:s.nx,nz:s.nz,level:s.y,lake:true});
 for(const [ri,r] of (world.rivers||[]).entries())for(let i=5;i<r.count-5;i+=12){
  const o=i*S,d=r.data;if(d[o+RV.SPEED]>.8||d[o+RV.FOAM]>.12||d[o+RV.KIND]!==0)continue;
  candidates.push({id:`river:${ri}:${i}`,x:d[o+RV.X],z:d[o+RV.Z],nx:0,nz:0,level:d[o+RV.WL],lake:false});
 }
 const sites=[];
 for(const c of candidates){
  const rnd=new Random(`${seed}:pool:${c.id}`);
  // Inland water at any altitude, including alpine basins.
  if(c.level<seaLevel+1||rnd.chance(.18))continue;
  const x=c.x+c.nx*5,z=c.z+c.nz*5;
  if(sites.some(s=>Math.hypot(x-s.x,z-s.z)<65))continue;
  const groups=[];
  for(let attempt=0;attempt<5;attempt++){
   const inward=c.lake?rnd.range(14,55):0,fx=x+c.nx*inward+rnd.range(-12,12),fz=z+c.nz*inward+rnd.range(-12,12);
   const radius=rnd.range(FISH_MIN_RADIUS,22),centre=sample(fx,fz);
   if(!calmWater(centre,c.level,2.6,300))continue;
   if(groups.some(g=>Math.hypot(fx-x-g.x,fz-z-g.z)<g.radius+radius*.8))continue;
   const depth=waterClearance(sample,fx,fz,radius+3.5,c.level);if(!depth)continue;
   const count=rnd.pick([1,2,4,6,9,13].filter(n=>n<=radius*.65));
   groups.push({x:fx-x,z:fz-z,count,radius,depth,speed:rnd.range(2.8,5.2)/radius,direction:rnd.chance(.5)?1:-1,phase:rnd.range(0,TAU),aspect:rnd.range(.68,.92),turn:rnd.range(0,TAU)});
   if(groups.length===2||rnd.chance(.5))break;
  }
  const plants=[],target=rnd.pick([0,2,3,4,6]),patchPalette=rnd.int(0,LILY_PALETTES.length-1);
  for(let n=0;n<target*12&&plants.length<target;n++){
   const a=rnd.range(0,TAU),r=Math.sqrt(rnd.next())*26,px=x+Math.cos(a)*r+c.nx*8,pz=z+Math.sin(a)*r+c.nz*8;
   // Large adults with small companions; not a row of equally scaled flowers.
   const size=plants.length===0?rnd.range(5,7.5):rnd.chance(.35)?rnd.range(1.8,3):rnd.range(3.5,6);
   if(plants.some(p=>Math.hypot(p.x-px,p.z-pz)<(p.size+size)*1.3))continue;
   const s=sample(px,pz);if(!calmWater(s,c.level,.6,14))continue;
   let valid=true;for(let k=0;k<16;k++){const a=k/16*TAU;if(!calmWater(sample(px+Math.cos(a)*size*1.7,pz+Math.sin(a)*size*1.7),c.level,.2,18)){valid=false;break;}}
   if(valid)plants.push({x:px,z:pz,size,depth:s.water-s.ground,turn:rnd.range(0,TAU),phase:rnd.range(0,TAU),bloom:plants.length===0||rnd.chance(.85),openness:rnd.range(.65,1.25),petalLength:rnd.range(.8,1.35),flowerShape:rnd.int(0,2),padAspect:rnd.range(.7,1.2),padCount:rnd.int(1,3),palette:rnd.chance(.55)?patchPalette:rnd.int(0,LILY_PALETTES.length-1),tint:rnd.range(.88,1.12),replyAt:-100,replyCount:0,glow:0,nod:0,nods:[]});
  }
  // Independent seed keeps existing placements/palettes stable. Adults include
  // upright cups; companions mix shallow saucers, open cups and taller blooms.
  const profiles=new Random(`${seed}:lily-profiles:${c.id}`);
  plants.forEach((p,i)=>{p.flowerHeight=i===0?profiles.range(1.3,1.6):i===1?profiles.range(.55,.75):profiles.chance(.5)?profiles.range(.85,1.1):profiles.range(1.25,1.65);});
  if(!groups.length&&!plants.length)continue;
  const radius=Math.max(45,...groups.map(g=>Math.hypot(g.x,g.z)+g.radius+4));
  sites.push({id:c.id,x,z,y:c.level,lake:c.lake,groups,plants,radius});
 }
 return sites;
}

// Independent lanes spread and regroup over time; individual excursions are
// bounded inside the validated disk, with no per-frame terrain sampling.
export class PoolLifeModel {
 constructor(site,seed,{canSwim=null}={}){
  this.canSwim=canSwim||((x,z,f)=>Math.hypot(x-(f.group.x||0),z-(f.group.z||0))<=f.group.radius*.93);
  this.site=site;this.time=0;this.lastNote=-100;this.noteCount=0;this.pending=[];this.events=[];this.fish=[];
  this.plants=site.plants.map((p,index)=>({...p,index,nods:[],x:p.x-site.x,z:p.z-site.z}));
  const rnd=new Random(`${seed}:fish:${site.id}`);this.replyRandom=new Random(`${seed}:lily-replies:${site.id}`);
  for(const [school,g] of site.groups.entries())for(let i=0;i<g.count;i++){
   const size=rnd.chance(.3)?rnd.range(.75,1.15):rnd.range(1.4,2.1);
   this.fish.push({school,group:g,offset:(i/Math.max(1,g.count))*TAU+rnd.range(-.25,.25),lane:rnd.range(.53,.83),pace:rnd.range(.92,1.08),wander:rnd.range(.035,.09),size,bodyWidth:rnd.range(.65,1.18),bodyLength:rnd.range(.9,1.3),hue:rnd.range(-.012,.009),color:rnd.pick(['#ff3522','#ff6540','#ef1957','#ffac52','#ee352f']),marking:rnd.int(0,3),beat:rnd.range(0,TAU),depth:rnd.range(.95,Math.min(1.75,g.depth-1.1))});
  }
  const depths=new Random(`${seed}:fish-depths:${site.id}`);
  for(const [i,f] of this.fish.entries()){
   const half=.4*f.size*(.8+.2*f.bodyWidth);
   f.depth=half+.32+rnd.next()*Math.max(0,Math.min(.65,f.group.depth-2*half-.65));
   // The shallowest bed across the whole home disk bounds every dive. Keep
   // shallow pools near the surface; deeper pools open up distinct swim lanes.
   const range=Math.min(18,Math.max(0,f.group.depth-4)*.7);
   const schoolIndex=i-this.fish.findIndex(other=>other.school===f.school);
   f.depth+=range*(schoolIndex+depths.next())/f.group.count;
   f.depthAmplitude=Math.min(range*.12,1.2,f.depth-half-.32,f.group.depth-half-.32-f.depth);
   f.depthPhase=depths.range(0,TAU);f.depthRate=depths.range(.12,.22);
   f.maxDepth=f.depth+f.depthAmplitude+.09;
  }
  this.update(0);
 }
 pose(f,time){
  const g=f.group,spread=.45+.35*(.5+.5*Math.sin(time*.16+g.phase)),a=(time*g.speed+Math.sin(time*.38+g.phase)*.16)*g.direction+g.phase-f.offset*spread+Math.sin(time*.27*f.pace+f.beat)*.18;
  const orbit=g.radius*(f.lane+Math.sin(time*.33+f.beat)*f.wander),ct=Math.cos(g.turn),st=Math.sin(g.turn);
  const x=Math.cos(a)*orbit,z=Math.sin(a)*orbit*g.aspect;
  return {x:(g.x||0)+x*ct-z*st,z:(g.z||0)+x*st+z*ct};
 }
 swimY(f,time){return -f.depth+Math.sin(time*f.depthRate+f.depthPhase)*f.depthAmplitude+Math.sin(time*1.1+f.beat)*.09;}
 curve(points,t){
  const u=1-t;
  if(points.length===5){const weights=[u**4,4*u**3*t,6*u*u*t*t,4*u*t**3,t**4];return points.reduce((p,q,i)=>({x:p.x+q.x*weights[i],z:p.z+q.z*weights[i]}),{x:0,z:0});}
  const [a,b,c,d]=points;
  return {x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,z:u*u*u*a.z+3*u*u*t*b.z+3*u*t*t*c.z+t*t*t*d.z};
 }
 swimPose(f,time){
  const b=f.escape;if(!b)return this.pose(f,time);
  const age=Math.max(0,time-b.at);if(age>=b.duration+b.returnDuration)return this.pose(f,time);
  return age<b.duration?this.curve(b.out,age/b.duration):this.curve(b.back,clamp((age-b.duration)/b.returnDuration,0,1));
 }
 startle(x,z,radius,charge){
  let heard=false;
  for(const f of this.fish){
   const dx=f.x+this.site.x-x,dz=f.z+this.site.z-z,d=Math.hypot(dx,dz);if(d>radius)continue;
   const away=Math.atan2(dz,dx)+Math.sin(f.beat)*.18,start={x:f.x,z:f.z},g=f.group;
   const heading={x:Math.cos(f.yaw),z:-Math.sin(f.yaw)};
   // Plan a complete turning loop through open water on the blip only. The
   // return meets the original cruise route at its future position and heading.
   // The world supplies terrain clearance, rather than the old school boundary.
   let trip=null;
   for(const distance of [34+charge*10+f.size*3,25,16,9]){
    for(const offset of [0,.4,-.4,.85,-.85,1.25,-1.25]){
     const angle=away+offset,ux=Math.cos(angle),uz=Math.sin(angle);
     const end={x:start.x+ux*distance,z:start.z+uz*distance};
     // A brisk launch; the long, relaxed return keeps its own timing.
     const duration=.7+distance/26,returnDuration=5+distance/9,returnAt=this.time+duration+returnDuration;
     const home=this.pose(f,returnAt),next=this.pose(f,returnAt+.025),speed=Math.hypot(next.x-home.x,next.z-home.z)/.025||1;
     const reach=Math.min(7,distance*.2),side=Math.sign(heading.x*uz-heading.z*ux)||1,arc=(heading.x*ux+heading.z*uz<-.3?reach*1.5:reach*.3)*side,out=[start,{x:start.x+heading.x*reach,z:start.z+heading.z*reach},{x:end.x-ux*reach-uz*arc,z:end.z-uz*reach+ux*arc},end];
     const back=[end,{x:end.x+ux*reach,z:end.z+uz*reach},{x:(end.x+home.x)*.5-uz*distance*.55*side,z:(end.z+home.z)*.5+ux*distance*.55*side},{x:home.x-(next.x-home.x)/(.025*speed)*reach,z:home.z-(next.z-home.z)/(.025*speed)*reach},home];
     let valid=true;
     for(const path of [out,back]){
      // Sample by control-polygon length, at most 1.5 units between samples.
      const length=path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.z-path[i].z),0),steps=Math.ceil(length/1.5);
      for(let i=1;i<=steps;i++){const p=this.curve(path,i/steps);if(Math.hypot(p.x-(g.x||0),p.z-(g.z||0))>g.radius+65||!this.canSwim(p.x,p.z,f)){valid=false;break;}}
      if(!valid)break;
     }
     if(valid){trip={at:this.time,out,back,duration,returnDuration};break;}
    }
    if(trip)break;
   }
   if(trip){f.escape=trip;heard=true;}
  }
  return heard;
 }
 update(time){
  const dt=Math.max(0,time-this.time);this.time=time;
  for(const f of this.fish){
   if(f.escape&&time-f.escape.at>=f.escape.duration+f.escape.returnDuration)delete f.escape;
   const p=this.swimPose(f,time),next=this.swimPose(f,time+.025);
   f.burst=f.escape?Math.max(0,1-(time-f.escape.at)/(f.escape.duration+1)):0;
   f.x=p.x;f.z=p.z;f.y=this.swimY(f,time);const yaw=Math.atan2(-(next.z-p.z),next.x-p.x);
   if(f.escape&&Number.isFinite(f.yaw)){const turnRate=time-f.escape.at<f.escape.duration?5.6:3.2,turn=Math.atan2(Math.sin(yaw-f.yaw),Math.cos(yaw-f.yaw));f.yaw+=clamp(turn,-dt*turnRate,dt*turnRate);}else f.yaw=yaw;
   f.speed=Math.hypot(next.x-p.x,next.z-p.z)/.025;
  }
  // Gentle local separation keeps large adults from stacking into a dark blob.
  for(let pass=0;pass<2;pass++)for(let i=0;i<this.fish.length;i++)for(let j=i+1;j<this.fish.length;j++){
   const a=this.fish[i],b=this.fish[j];if(a.school!==b.school||a.escape||b.escape)continue;
   const dx=a.x-b.x,dz=a.z-b.z,d=Math.hypot(dx,dz)||.001,min=Math.sqrt(Math.max(0,((a.size+b.size)*.9)**2-(a.y-b.y)**2));
   if(d>=min)continue;const push=(min-d)*.5/d;
   a.x+=dx*push;a.z+=dz*push;b.x-=dx*push;b.z-=dz*push;
  }
  for(const f of this.fish){if(f.escape)continue;const g=f.group,dx=f.x-(g.x||0),dz=f.z-(g.z||0),r=Math.hypot(dx,dz),limit=g.radius*.95;if(r>limit){f.x=(g.x||0)+dx/r*limit;f.z=(g.z||0)+dz/r*limit;}}
  while(this.pending.length&&this.pending[0].at<=time){const e=this.pending.shift(),p=this.plants[e.plant];p.replyAt=e.at;p.strength=e.strength;p.replyCount++;p.nods.push({at:e.at,strength:e.strength});if(this.events.length<16)this.events.push(e);}
  for(const p of this.plants){
   const age=time-p.replyAt;p.glow=age<0?0:Math.sin(Math.min(1,age/.075)*Math.PI/2)*Math.exp(-age*(p.size>4?1.5:2.1))*(p.strength||1);
   p.nods=p.nods.filter(n=>time-n.at<2);p.nod=.22*Math.tanh(p.nods.reduce((v,n)=>{const t=time-n.at;return v+Math.sin(t*9)*Math.exp(-t*3)*n.strength;},0));
  }
 }
 hear(x,z,radius,charge=0,target=null){
  charge=clamp(charge,0,1);const startled=this.startle(x,z,radius,charge);
  const waiting=new Set(this.pending.map(e=>e.plant)),candidates=this.plants.filter(p=>p.bloom&&(p.index===target||Math.hypot(p.x+this.site.x-x,p.z+this.site.z-z)<=radius))
   .map(p=>({p,rank:p.replyCount+this.replyRandom.next()*.9+(waiting.has(p.index)?100:0)}));
  if(!candidates.length)return startled;
  charge=clamp(charge,0,1);const interval=this.time-this.lastNote,chorus=charge>2/3;
  candidates.sort((a,b)=>(b.p.index===target)-(a.p.index===target)||a.rank-b.rank);
  const count=chorus?candidates.length:Math.min(candidates.length,interval<.5&&target===null?1:2+this.noteCount%2);
  const beat=interval<1.8?clamp(interval*.6,.12,.3):.21;
  const replies=candidates.slice(0,count).map(({p},i)=>({plant:p.index,at:this.time+.045+(chorus?0:i*beat),strength:chorus?1.25:i?.8:1,chorus}));
  const chosen=new Set(replies.map(e=>e.plant));
  this.pending=[...replies,...(chorus?[]:this.pending.filter(e=>!chosen.has(e.plant)))].sort((a,b)=>a.at-b.at).slice(0,8);
  this.lastNote=this.time;this.noteCount++;return true;
 }
 drainEvents(){return this.events.splice(0);}
}
