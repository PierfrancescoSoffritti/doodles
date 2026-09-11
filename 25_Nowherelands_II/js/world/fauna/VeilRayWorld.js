import { receiveNote, updateNote } from './NoteResponse.js?v=player-notes-13';
import { rayEnvelope } from '../../audio/VeilRayVoice.js';
import { motor, damp, clamp, angleDelta } from './Locomotion.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const routine=new Set(['skim','cross','rest','return','company']);
const encounter=new Set(['approach','pass','follow']);
const local=(s,t,n,y=10)=>({x:s.x+s.tx*t+s.nx*n,y:s.y+y,z:s.z+s.tz*t+s.nz*n});
export function safeRayPoint(c,p) {
 const s=c.group.raySite, radius=s.radius-c.radius-2;
 let t=(p.x-s.x)*s.tx+(p.z-s.z)*s.tz, n=(p.x-s.x)*s.nx+(p.z-s.z)*s.nz;
 const f=Math.min(1,radius/(Math.hypot(t,n)||1));t*=f;n*=f;
 if(c.group.members.length===2) n=c.index?Math.max(12,n):Math.min(-12,n);
 const reach=Math.sqrt(Math.max(0,radius*radius-n*n));t=clamp(t,-reach,reach);
 return local(s,t,n,clamp(p.y-s.y,c.radius+0.8,14));
}
function pathPoint(path,t) {
 const a=path.points,u=1-t,p={};
 for(const axis of ['x','y','z'])p[axis]=u**3*a[0][axis]+3*u*u*t*a[1][axis]+3*u*t*t*a[2][axis]+t**3*a[3][axis];
 return p;
}
function route(c,m,p,state,seconds,heading) {
 const end=safeRayPoint(c,p), d=distance(c.pos,end), duration=seconds||Math.max(9,d/(state==='rest'?1.2:2.7));
 const h=heading||{x:end.x-c.pos.x,z:end.z-c.pos.z}, len=Math.hypot(h.x,h.z)||1;
 const speed=state==='rest'?0.5:state==='retreat'?3.5:2.6;
 c.path={start:m.time,duration,points:[{...c.pos},safeRayPoint(c,{x:c.pos.x+c.vel.x*duration/3,y:c.pos.y+c.vel.y*duration/3,z:c.pos.z+c.vel.z*duration/3}),safeRayPoint(c,{x:end.x-h.x/len*speed*duration/3,y:end.y,z:end.z-h.z/len*speed*duration/3}),end]};
 c.state=state;
}
export function initializeWorldRays(g,m,site) {
 g.raySite=site;g.home={x:site.x,y:site.y+11,z:site.z};g.quiet=0;g.invitations=[];g.nextSocial=m.time+22;g.reply=null;g.avoidUntil=0;
 g.members.forEach((c,i)=>{
  c.born=m.time;c.index=i;c.radius=8.2*c.size;c.pos=safeRayPoint(c,local(site,-18+i*25,i?18:-18));c.prev={...c.pos};
  c.vel={x:site.tx*2.6,y:0,z:site.tz*2.6};c.yaw=c.prevYaw=Math.atan2(-site.tz,site.tx);
  c.bank=c.pitch=c.prevBank=c.prevPitch=0;c.nextInvite=0;c.voiceAt=-100;c.callAt=Infinity;c.callPhrase='contact';c.stop=i;c.calls=0;
  route(c,m,local(site,20,i?18:-18),'skim',15);
 });
}
export function worldRayCall(c,m,phrase='contact') {
 const g=c.group;
 if(m.raysHidden || m.time<g.avoidUntil || m.time-c.voiceAt<7 || m.time<(m.rayVoiceUntil||0))return false;
 // Light and social reply follow only an accepted sound, never a muted attempt.
 if(m.onCall(c,false,phrase)!==true)return false;
 c.voiceAt=m.time;c.callPhrase=phrase;c.calls++;m.rayVoiceUntil=m.time+7;return true;
}
function retreat(g,m,members=g.members) {
 g.quiet=0;g.reply=null;g.avoidUntil=m.time+18;
 for(const c of members){c.nextInvite=g.avoidUntil+12;c.voiceAt=-100;c.energy=0;if(c.state!=='retreat')route(c,m,local(g.raySite,-15+c.index*30,24,13),'retreat',10);}
 m.onRaySilence?.(g);
}
export function hearWorldRays(g,m,{position=m.listener,strength=0.5,layer='',radius}) {
 if(m.raysHidden)return false;
 if(layer!=='player-note'&&(distance(position,g.home)>100||Math.abs(position.y-g.home.y)>30))return false;
 if(layer==='player-note'){let heard=false;for(const c of g.members)heard=receiveNote(c,m.time,{layer,position,velocity:strength,radius},{range:110,duration:8})||heard;return heard;}
 if(layer!=='invitation' && layer!=='ray-player')return false;
 g.invitations=g.invitations.filter(t=>m.time-t<5);g.invitations.push(m.time);
 if(strength>0.75||g.invitations.length>=3){retreat(g,m);return false;}
 if(g.quiet<4 || m.time<g.avoidUntil || g.sheltered)return false;
 const c=g.members.filter(c=>routine.has(c.state)&&m.time>=c.nextInvite&&distance(c.pos,position)<65).sort((a,b)=>distance(a.pos,position)-distance(b.pos,position))[0];
 if(!c)return false;
 const target=safeRayPoint(c,position);
 // Only acknowledge reachable shoreline. Projection must leave a comfortable pass.
 if(distance(target,position)>32)return false;
 c.passPoint=target;c.nextInvite=m.time+55;c.followUntil=0;g.reply=null;
 const s=g.raySite;
 route(c,m,{x:target.x-s.tx*10,y:target.y,z:target.z-s.tz*10},'approach',clamp(distance(c.pos,target)/3.2,7,16),{x:s.tx,z:s.tz});
 return true;
}
function returnHome(c,m){route(c,m,local(c.group.raySite,-12+c.index*24,c.index?20:-15),'return',13);}
function nextRoute(c,m) {
 const g=c.group,s=g.raySite,p=m.listener;
 if(m.time<g.avoidUntil || g.sheltered){route(c,m,local(s,c.pos.x>s.x?-12:12,c.index?24:-14),'rest',14);return;}
 if(c.state==='approach'){
  route(c,m,{x:c.passPoint.x+s.tx*10,y:c.passPoint.y,z:c.passPoint.z+s.tz*10},'pass',8.5,{x:s.tx,z:s.tz});
  if(!c.noteGreeting)worldRayCall(c,m,'acknowledgment');c.noteGreeting=false;return;
 }
 if(c.state==='pass'||c.state==='follow'){
  if(!m.observing && m.playerSpeed>0.2 && m.playerSpeed<=8 && distance(c.pos,p)<42){
   c.followUntil ||= m.time+10;
   if(m.time<c.followUntil){const v=m.playerVelocity||m.listenerVelocity,sign=Math.sign(v.x*s.tx+v.z*s.tz)||1;
    route(c,m,{x:p.x+s.tx*sign*10,y:s.y+10,z:p.z+s.tz*sign*10},'follow',4,{x:s.tx*sign,z:s.tz*sign});return;}
  }
  returnHome(c,m);return;
 }
 if(c.state==='retreat'){returnHome(c,m);return;}
 const stops=[[-22,-16,10],[20,-18,10],[20,18,13],[-12,24,11]],index=c.stop++%4;
 const [t,n,height]=stops[index], y=m.rayWeather?.bright?10:height;route(c,m,local(s,t+c.rnd.range(-2,2),n+c.rnd.range(-2,2),y),index===3?'rest':index===2?'cross':'skim');
}
export function updateWorldRays(g,m,dt) {
 for(const c of g.members){
 if(m.raysHidden||g.sheltered)c.noteResponse=null;
 updateNote(c,m.time,r=>{
  if(r.alarm){retreat(g,m,[c]);return;}
  g.reply=null;c.noteGreeting=true;
  // Each accepted note gets its own bank, even during a previous pass/cooldown.
  c.noteBankAt=m.time;c.noteBankSign=c.index?1:-1;c.powered=true;c.motorTimer=4;
  if(m.time>=g.avoidUntil){
   c.passPoint=safeRayPoint(c,r.source);c.followUntil=0;
   route(c,m,c.passPoint,'approach',clamp(distance(c.pos,c.passPoint)/5,4,7),{x:g.raySite.tx,z:g.raySite.tz});
  }
 },r=>{if(r.alarm)m.onNoteReply?.('ray',c,true);else if(!worldRayCall(c,m,'acknowledgment'))m.onNoteReply?.('ray',c,false);});
 }
 const speed=m.playerSpeed??Math.hypot(m.listenerVelocity.x,m.listenerVelocity.z),p=m.listener;
 const near=distance(p,g.home)<100 && Math.abs(p.y-g.home.y)<30;
 g.quiet=near&&speed<0.5&&!m.raysHidden?g.quiet+dt:0;
 const sheltered=(m.rayWeather?.storm||0)>0.65 || (m.rayWeather?.rain||0)>0.8 || (m.rayWeather?.wind||0)>18;
 if(m.raysHidden){g.reply=null;for(const c of g.members)c.voiceAt=-100;}
 if(sheltered&&!g.sheltered){g.reply=null;for(const c of g.members){c.voiceAt=-100;route(c,m,local(g.raySite,-12+c.index*24,c.index?24:-14),'rest',12);}m.onRaySilence?.(g);}
 g.sheltered=sheltered;
 if(!m.observing&&!m.raysHidden&&near&&g.members.some(c=>distance(c.pos,p)<9 || (speed>55&&distance(c.pos,p)<45)))retreat(g,m);
 for(const c of g.members){
  if(encounter.has(c.state)&&(m.raysHidden||distance(p,c.passPoint)>65||Math.abs(p.y-c.pos.y)>30))returnHome(c,m);
  if(m.time>=c.path.start+c.path.duration)nextRoute(c,m);
  const {points:a,duration,start}=c.path,t=clamp((m.time-start)/duration,0,1),u=1-t;
  const next={},velocity={};
  for(const axis of ['x','y','z']){next[axis]=u**3*a[0][axis]+3*u*u*t*a[1][axis]+3*u*t*t*a[2][axis]+t**3*a[3][axis];velocity[axis]=(3*u*u*(a[1][axis]-a[0][axis])+6*u*t*(a[2][axis]-a[1][axis])+3*t*t*(a[3][axis]-a[2][axis]))/duration;}
  // Recheck streamed trunks/rocks before advancing. Never squeeze the membrane through.
  if(m.environment.blocked?.(next.x,next.z,c.radius+2,next.y)){
   c.vel={x:0,y:0,z:0};c.energy=0;c.voiceAt=-100;g.reply=null;
   if(m.time>=(c.retryRouteAt||0)){
    c.retryRouteAt=m.time+2;m.onRaySilence?.(g);
    const old=c.path;let found=false;
    for(let i=0;i<8&&!found;i++){
     route(c,m,local(g.raySite,c.rnd.range(-22,22),c.rnd.range(-24,24)),'return',12);
     found=true;for(let k=1;k<=24;k++){const q=pathPoint(c.path,k/24);if(m.environment.blocked(q.x,q.z,c.radius+3,q.y)){found=false;break;}}
    }
    if(!found)c.path=old;
   }
   c.path.start+=dt;continue;
  }
  Object.assign(c.pos,next);Object.assign(c.vel,velocity);c.speed=Math.hypot(c.vel.x,c.vel.z);
  if(c.speed>0.15)c.yaw+=clamp(angleDelta(Math.atan2(-c.vel.z,c.vel.x),c.yaw),-0.65*dt,0.65*dt);
  const bankAge=m.time-(c.noteBankAt??-100),noteBank=!c.noteAlarm&&c.noteGlow>0&&bankAge<3.2?Math.sin(Math.PI*clamp(bankAge/3.2,0,1))*.58*c.noteBankSign:0;
  c.turnRate=(c.yaw-c.prevYaw)/dt;c.bank=damp(c.bank,clamp(c.turnRate*c.speed*0.065+noteBank,-0.65,0.65),4,dt);
  c.bend=damp(c.bend,clamp(c.turnRate*0.7,-0.7,0.7),4,dt);c.pitch=damp(c.pitch,clamp(Math.atan2(c.vel.y,Math.max(1,c.speed)),-0.25,0.25),3,dt);
  c.energy=Math.max(rayEnvelope(m.time-c.voiceAt,c.callPhrase)*0.75,c.noteGlow);motor(c,dt,c.state==='retreat');if(c.state==='rest')c.effort=damp(c.effort,0.12,5,dt);
 }
 if(!g.sheltered&&!m.raysHidden&&m.time>=g.nextSocial&&m.time>=g.avoidUntil&&g.members.every(c=>routine.has(c.state))){
  const [a,b]=g.members;
  if(distance(a.pos,p)<100 && worldRayCall(a,m)){if(b)g.reply={c:b,at:m.time+7};}
  g.nextSocial=m.time+38+g.rnd.range(0,16);
  if(b)for(const c of g.members)route(c,m,local(g.raySite,a.pos.x>g.raySite.x?-18:18,c.index?18:-18),'company',16);
 }
 if(g.reply&&m.time>=g.reply.at){if(routine.has(g.reply.c.state))worldRayCall(g.reply.c,m);g.reply=null;}
}
