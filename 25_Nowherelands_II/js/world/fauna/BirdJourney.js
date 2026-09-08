// A deliberately choreographed encounter, independent of rendering. Distances
// are bird-study metres, not the living world's enlarged vegetation scale.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
const vec = (x, y, z) => ({ x, y, z });
export const BIRD_GROUND = Object.freeze(vec(-5, 0, 1));
export const BIRD_PERCH = Object.freeze(vec(5, 3, 0));
export const BIRD_FLIGHT_TIME = 1.65;
export const BIRD_ANTICIPATION = .28;
export const BIRD_SETTLE_TIME = .32;
export const BIRD_JOURNEY_TIME = BIRD_ANTICIPATION + BIRD_FLIGHT_TIME + BIRD_SETTLE_TIME;
const ANTICIPATION = BIRD_ANTICIPATION;

// Each knot includes a velocity in metres/second. Cubic Hermite segments share
// both position and velocity; the bird reaches its contact with zero velocity.
function route(from, to, returning) {
 const s = returning ? -1 : 1;
 return [
  { t: 0, p: vec(from.x, from.y + .31, from.z), v: vec(0, 0, 0) },
  { t: .24, p: vec(from.x + 1.5*s, from.y + 1.30, from.z-.16), v: vec(9*s, returning ? 1 : 6, -.8) },
  { t: .84, p: vec(from.x + 6.2*s, returning ? 2.95 : 3.96, from.z-.35), v: vec(8*s, returning ? -3.8 : -.1, .15) },
  { t: 1.25, p: vec(to.x - 1.0*s, to.y+.70, to.z-.16), v: vec(6*s, returning ? -3.7 : -1.5, .8) },
  { t: 1.42, p: vec(to.x - .28*s, to.y+.56, to.z-.03), v: vec(3.2*s, -1.5, .39) },
  { t: BIRD_FLIGHT_TIME, p: vec(to.x, to.y + .42, to.z), v: vec(0, 0, 0) },
 ];
}

function flightAt(knots, time) {
 const t = clamp(time, 0, BIRD_FLIGHT_TIME);
 const i = Math.min(knots.length - 2, Math.max(0, knots.findIndex(k => k.t >= t) - 1));
 const a = knots[i], b = knots[i + 1], h = b.t - a.t, u = (t - a.t) / h;
 const u2 = u * u, u3 = u2 * u, p = {}, v = {};
 for (const axis of ['x', 'y', 'z']) {
  p[axis] = (2*u3-3*u2+1)*a.p[axis] + (u3-2*u2+u)*h*a.v[axis] + (-2*u3+3*u2)*b.p[axis] + (u3-u2)*h*b.v[axis];
  v[axis] = (6*u2-6*u)*a.p[axis]/h + (3*u2-4*u+1)*a.v[axis] + (-6*u2+6*u)*b.p[axis]/h + (3*u2-2*u)*b.v[axis];
 }
 return { p, v };
}

// Feet stay at their contacts while the torso lowers and the head reaches down.
// Two quick pecks are separated by several seconds of quieter observation.
function idlePose(pose,time,ground){
 const cycle=time%5.6;
 const peckAt=a=>ramp(cycle,a,a+.22)*(1-ramp(cycle,a+.30,a+.60));
 const peck=ground?Math.max(peckAt(.40),peckAt(1.25),peckAt(2.22)):0;
 const stretch=ramp(cycle,3.05,3.38)*(1-ramp(cycle,3.72,4.12));
 const shake=ramp(cycle,4.25,4.4)*(1-ramp(cycle,4.75,4.95));
 const supportY=pose.position.y+pose.footY;
 pose.position.y+=.005*Math.sin(time*1.7)**2-.11*peck;
 pose.footY=supportY-pose.position.y;
 pose.pitch+=.035*Math.sin(time*2.3)*(1-peck)-.55*peck;
 pose.bank=(.065*Math.sin(time*1.9)**5+.085*Math.sin(time*36)*shake)*(1-peck);
 pose.headYaw=(.75*Math.sin(time*2.1)**5+.12*Math.sin(time*32)*shake)*(1-peck);
 pose.headPitch=-.55*peck+.075*Math.sin(time*1.2)*(1-peck);
 pose.tail=.13*Math.sin(time*3.1)**2+.35*stretch;
 pose.fold=1-.5*stretch-.08*shake;pose.shoulder=.1+.55*stretch;pose.wrist=.2*stretch;
 pose.activity=peck>.1?'peck':stretch>.1?'stretch':shake>.1?'ruffle':Math.abs(pose.bank)>.015?'shift':'watch';
 return pose;
}

export class BirdJourney {
 constructor({fromGround=true,toGround=false,idleTempo=1,flapRate=6.8}={}) { this.fromGround=fromGround;this.toGround=toGround;this.idleTempo=idleTempo;this.flapRate=flapRate;this.reset(); }
 reset() { this.time = 0; this.idleTime = 0; this.startYaw=0; this.startPose=null; this.active = false; this.returning = false; this.completed = false; this.knots = route(BIRD_GROUND, BIRD_PERCH, false); }
 start() {
  if (this.active) return false;
  this.startPose=this.sample(); this.startYaw=this.startPose.yaw;
  this.returning = this.completed ? !this.returning : false;
  this.knots = route(this.returning ? BIRD_PERCH : BIRD_GROUND, this.returning ? BIRD_GROUND : BIRD_PERCH, this.returning);
  this.time = 0; this.active = true; this.completed = false; return true;
 }
 seek(time) { this.idleTime=0; this.time = clamp(time, 0, BIRD_JOURNEY_TIME); this.active = this.time < BIRD_JOURNEY_TIME; this.completed = !this.active; }
 update(dt) {
  if(this.active){
   const next=this.time+dt;this.time=Math.min(BIRD_JOURNEY_TIME,next);
   if(next>=BIRD_JOURNEY_TIME){this.active=false;this.completed=true;this.idleTime=next-BIRD_JOURNEY_TIME;}
  }else this.idleTime+=dt;
  return this.sample();
 }
 sample() {
  const t = this.time, f = t - ANTICIPATION;
  const from = this.returning ? BIRD_PERCH : BIRD_GROUND, to = this.returning ? BIRD_GROUND : BIRD_PERCH;
  const pose = { position: vec(from.x, from.y + .42, from.z), yaw: this.returning ? Math.PI : 0, pitch: .12, bank: 0,
   shoulder: .1, wrist: 0, fold: 1, tail: 0, legs: 1, contact: 1, footY: -.42, headYaw: 0, headPitch: 0, speed: 0, state: (this.returning?this.toGround:this.fromGround)?'ground':'perched' };
  if (!this.active && !this.completed && t === 0) {
   return idlePose(pose,this.idleTime*this.idleTempo,this.fromGround);
  }
  if (f < 0) {
   pose.state = t < .15 ? 'alert' : 'crouch';
   const turn=Math.atan2(Math.sin(pose.yaw-this.startYaw),Math.cos(pose.yaw-this.startYaw));
   pose.yaw=this.startYaw+turn*ramp(t,0,.15);
   const crouch = ramp(t, .15, ANTICIPATION);
   pose.position.y -= .11 * crouch; pose.footY = from.y - pose.position.y;
   pose.pitch = mix(.12, -.08, crouch); pose.headPitch = .14 * (1 - crouch);
   pose.fold = 1 - .35 * crouch; pose.shoulder = .9 * crouch;
   if(this.startPose){
    const k=ramp(t,0,.12);
    pose.position.y=mix(this.startPose.position.y,pose.position.y,k);
    for(const key of ['pitch','bank','headPitch','headYaw','fold','tail'])pose[key]=mix(this.startPose[key],pose[key],k);
    pose.footY=from.y-pose.position.y;
   }
   return pose;
  }
  const flight = flightAt(this.knots, f), look = flightAt(this.knots, clamp(f, .015, BIRD_FLIGHT_TIME - .015));
  pose.position = flight.p; pose.speed = Math.hypot(flight.v.x, flight.v.y, flight.v.z);
  const heading=Math.atan2(-look.v.z, look.v.x),launchYaw=this.returning?Math.PI:0;
  pose.yaw = launchYaw+Math.atan2(Math.sin(heading-launchYaw),Math.cos(heading-launchYaw))*ramp(f,0,.07);
  const before = flightAt(this.knots, Math.max(.005, f - .035)).v;
  const after = flightAt(this.knots, Math.min(BIRD_FLIGHT_TIME - .005, f + .035)).v;
  const turn = Math.atan2(before.x * after.z - before.z * after.x, before.x * after.x + before.z * after.z) / .07;
  const brake = ramp(f, 1.30, 1.60), landing = ramp(f, 1.58, BIRD_FLIGHT_TIME);
  const glide = ramp(f, .84, .94) * (1 - ramp(f, 1.15, 1.28));
  const launch = 1 - ramp(f, .2, .5);
  // A fixed phase clock, with asymmetric stroke timing and flexed recovery.
  // The envelope follows this journey's climb/glide/braking demands.
  const phase = (f * this.flapRate) % 1;
  const down = phase < .43, u = down ? phase / .43 : (phase - .43) / .57;
  const flap = down ? Math.cos(u * Math.PI) : -Math.cos(u * Math.PI);
  const effort = (1 - glide * .96) * (1 - landing);
  pose.shoulder = .08 + flap * (.72 + launch * .22) * effort + brake * .18;
  pose.wrist = ((!down ? Math.sin(u * Math.PI) * .9 : -.14) + Math.sin(phase * Math.PI * 2 - .6) * .12) * effort;
  pose.fold = (1 - ramp(f, 0, .07)) * .65;
  pose.tail = .12 + brake * .88;
  pose.pitch = mix(Math.atan2(look.v.y, Math.hypot(look.v.x, look.v.z)) * .65, .85, brake);
  pose.pitch *= ramp(f, 0, .08); pose.pitch -= .08 * (1 - ramp(f, 0, .08));
  // Keep the gaze near the destination while the torso pitches up to brake.
  pose.headPitch = -pose.pitch * mix(.55, .9, brake) * ramp(f, 0, .08);
  pose.bank = clamp(-turn * pose.speed / 12, -.6, .6) * ramp(f, .15, .4) * (1 - brake);
  pose.legs = Math.max(1 - ramp(f, .03, .18), ramp(f, 1.32, 1.59));
  pose.contact = 1 - ramp(f, 0, .04); pose.footY = from.y - pose.position.y;
  pose.state = f < .30 ? 'takeoff' : glide > .6 ? 'glide' : f > 1.30 ? 'landing' : 'flight';
  if (f >= BIRD_FLIGHT_TIME) {
   const settle = clamp((f - BIRD_FLIGHT_TIME + 1e-9) / BIRD_SETTLE_TIME), k = smooth(settle);
   pose.state = settle < 1 ? 'settle' : (this.returning?this.fromGround:this.toGround)?'ground':'perched';
   pose.position = vec(to.x, to.y + .42 - .065 * Math.sin(settle * Math.PI), to.z);
   pose.speed = 0; pose.pitch = mix(.85, .12, k); pose.bank = 0;
   pose.headPitch = -pose.pitch * .9 * (1-k);
   pose.fold = k; pose.shoulder = mix(.26, .1, k); pose.wrist = 0; pose.tail = 1 - k;
   pose.legs = 1; pose.contact = 1; pose.footY = to.y - pose.position.y;
   if(settle===1)idlePose(pose,this.idleTime*this.idleTempo,this.returning?this.fromGround:this.toGround);
  }
  return pose;
 }
}
