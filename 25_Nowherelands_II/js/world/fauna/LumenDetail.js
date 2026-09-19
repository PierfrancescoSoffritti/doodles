import { hypot2, hypot3 } from '../../core/NumericDistance.js?v=stable-30-6';
import { trailPoint } from './LumenFlow.js?v=stable-30-20';
import { flightSwirl } from './LumenFlight.js?v=stable-30-20';

// Keep interaction-range flocks on the full model. The two thresholds prevent
// repeated changes at the boundary; a spread-out flock wakes as one unit.
export function selectLumenDetail(group, listener, enabled, scale=1) {
 const wake = b => {
  if(b.coarse)for(const c of b.members){c.neighbourTimer=0;c.floorTimer=0;c.acceleration.x=c.acceleration.y=c.acceleration.z=0;delete c.distantTarget;}
  b.coarse=false;
 };
 for (const b of group.flow.branches) {
  const radius=(b.coarse?1000:1200)*scale;
  const coarse=!!enabled && b.members.every(c=>(c.pos.x-listener.x)**2+(c.pos.y-listener.y)**2+(c.pos.z-listener.z)**2>radius*radius);
  if(!coarse)wake(b);
  b.coarse=coarse;
 }
 // An encounter crossing the detail boundary keeps both ribbons interactive.
 for(const b of group.flow.branches)if(b.weave?.branches.some(other=>!other.coarse))wake(b);
}

// Far animals keep individual phases and follow the same migrating guide/trail.
// Omit local neighbour/obstacle steering and refresh clearance at staggered 3 Hz.
// Positions remain continuous, so approaching or using the guide never reseeds a flock.
export function swimDistantLumen(c, model, dt) {
 const g=c.navigation,t=model.time,p=c.pos,q=c.shoreHome||g.bank;
 let resting=g.state==='resting'||(g.state==='settling'&&c.landed);
 const settling=g.state==='settling'&&!c.landed;
 let x,y,z;
 if(!c.distantTarget || t>=c.distantTargetAt || c.distantState!==g.state){
 const orbit=t*.42*c.orbit+c.phase;
 if(resting){
  const span=g.lake.shore?.length?20:24;
  x=q.x+(q.tx??1)*Math.sin(orbit)*span+(q.nx??0)*Math.cos(orbit*.71)*7;
  z=q.z+(q.tz??0)*Math.sin(orbit)*span+(q.nz??1)*Math.cos(orbit*.71)*7;
  y=q.y+7+c.heightOffset+Math.sin(orbit*.93)*2;
 }else{
  const trail=trailPoint(g,t-c.lag),active=Math.max(0,Math.min(1,(t-(g.playStart??g.stateSince)-6)/8));
  const swirl=flightSwirl(c,trail,t,active),speed=hypot2(trail.vx,trail.vz)||1;
  const width=c.lateral+Math.sin(t*.65*c.pace+c.phase)*12+Math.sin(t*.21+c.phase*2)*7;
  x=trail.x+swirl.x-trail.vz/speed*width*(1-active);
  z=trail.z+swirl.z+trail.vx/speed*width*(1-active);
  y=trail.y+swirl.y+(c.flightOffset+Math.sin(orbit*.7)*11)*(1-active);
  if(settling){const distance=hypot3(p.x-q.x,p.y-q.y-7,p.z-q.z),a=Math.max(0,Math.min(1,(distance-22)/130));x=q.x+swirl.x*a;y=q.y+7+swirl.y*a;z=q.z+swirl.z*a;if(distance<12){c.landed=true;resting=true;}}
 }
 c.distantTarget={x,y,z};c.distantState=g.state;
 // Recompute the distant motion target at 10 Hz, staggered by creature phase.
 // Integration and interpolation still advance on every fixed step.
 const phase=(c.phase%1)*.1;c.distantTargetAt=(Math.floor((t-phase)*10)+1)/10+phase;
 }else({x,y,z}=c.distantTarget);
 c.floorTimer-=dt;
 if(c.floorTimer<=0){const s=model.environment.sample(p.x,p.z,true);c.ground=s.ground;c.water=s.water;c.floorTimer=.28+c.temperament*.12;}
 y=Math.max(y,Math.max(c.ground,c.water)+2.2);
 const dx=x-p.x,dy=y-p.y,dz=z-p.z,length=hypot3(dx,dy,dz)||1;
 const speed=resting?8:(g.cruiseSpeed||70)+30;
 const k=Math.min(1-Math.exp(-dt*(resting?.9:2)),speed*c.pace*dt/length);
 c.vel.x=dx*k/dt;c.vel.y=dy*k/dt;c.vel.z=dz*k/dt;
 p.x+=dx*k;p.y+=dy*k;p.z+=dz*k;
 c.speed=hypot3(c.vel.x,c.vel.y,c.vel.z);c.effort=Math.max(.04,Math.min(1,c.speed/26+c.energy*.12));
 c.stroke+=dt*Math.PI*2*(.2+c.effort*1.3);c.breath+=dt*(.8+c.temperament*.3)*c.pulseRate;
 const decay=Math.exp(-7*dt);c.elastic.x*=decay;c.elastic.y*=decay;c.elastic.z*=decay;
 c.yaw=c.pitch=c.bank=c.bend=c.turnRate=0;c.resting=resting;
}
