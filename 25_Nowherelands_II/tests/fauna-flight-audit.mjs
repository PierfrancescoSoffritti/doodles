// Ten simulated minutes; no rendering. Sample flight once per second, excluding
// the immediate shore approach. Speeds are per-flock medians, not individual minima.
// Usage: node tests/fauna-flight-audit.mjs [grid resolution=1024] [seed=umbra]
import {generateWorld} from '../js/world/gen/WorldGen.js';
import {FaunaModel} from '../js/world/fauna/FaunaModel.js';
import {lumenLakes} from '../js/world/fauna/LumenSchool.js';
const seed=process.argv[3]||'umbra';
globalThis.location={search:'?seed='+encodeURIComponent(seed)};
const {Heightmap}=await import('../js/world/Heightmap.js');
const world=generateWorld(seed,null,{res:Number(process.argv[2]||1024)}),hm=new Heightmap(seed,world);
const sample=(x,z)=>{const ground=hm.sample(x,z),water=hm._water;return {ground,water,slope:hm._slope||0,foam:hm._foam||0,wet:1,forest:0};};
const lakes=lumenLakes(world,sample).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
const m=new FaunaModel(seed,{lakes,sample});m.observing=true;
const p=m.addGroup('lumen-flock','lumen',lakes[0].x,lakes[0].z,6);
const speeds=[],activity=[],heights=[],examples=[];let slow=0,flight=0,longestSlow=0,clearance=Infinity;
const runs=new Map(),settling=new Map();
for(let i=0;i<18000;i++) {
 m.step(1/30);
 if(i%30!==0)continue;
 for(const b of p.flow.branches) {
  if(b.state==='settling')settling.set(b.index,(settling.get(b.index)||0)+1);
  if(!['travelling','settling'].includes(b.state))continue;
  const near=b.destinationBank && Math.hypot(b.center.x-b.destinationBank.x,b.center.z-b.destinationBank.z)<75 && Math.abs(b.center.y-b.destinationBank.y)<30;
  if(near)continue;
  const v={x:0,y:0,z:0};for(const c of b.members)for(const k of ['x','y','z'])v[k]+=c.vel[k]/b.members.length;
  const s=b.members.map(c=>c.speed).sort((a,b)=>a-b),median=s[Math.floor(s.length/2)];
  let active=0,above=0;
  for(const c of b.members){const h=sample(c.pos.x,c.pos.z),ground=Math.max(h.ground,h.water);above+=c.pos.y-ground;clearance=Math.min(clearance,c.pos.y-ground);active+=Math.hypot(c.vel.x-v.x,c.vel.y-v.y,c.vel.z-v.z);}
  above/=b.members.length;active/=b.members.length;speeds.push(median);activity.push(active);heights.push(above);flight++;
  if(median<28){slow++;runs.set(b.index,(runs.get(b.index)||0)+1);longestSlow=Math.max(longestSlow,runs.get(b.index));}else runs.set(b.index,0);
  if(median<23 && above>180 && examples.length<4)examples.push({time:Math.round(m.time),flock:b.index,state:b.state,speed:Math.round(median),aboveGround:Math.round(above)});
 }
}
const q=(a,t)=>a.sort((x,y)=>x-y)[Math.floor((a.length-1)*t)];
console.log(JSON.stringify({seed,res:world.res,flightSamples:flight,slowPercent:100*slow/flight,longestSlowSeconds:longestSlow,speedP10:q(speeds,.1),speedMedian:q(speeds,.5),relativeMotionMedian:q(activity,.5),heightP90:q(heights,.9),heightMax:q(heights,1),clearance,examples,joins:p.flow.joins,streams:p.flow.branches.map(b=>({count:b.members.length,state:b.state,visits:b.visits,settlingSeconds:settling.get(b.index)||0}))},null,2));
