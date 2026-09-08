// One pass per behavior tick; never emit a sound for every physics foot substep.
export function updatePebbleSoundEvents(c,model) {
 const b=c.pebble,t=model.time,wet=c.water-c.ground>(b.soundWet?0:.2);
 const emit=event=>model.onPebbleSound(c,event);
 if(wet!==b.soundWet && b.soundWet!==undefined)emit(wet?'splash':'drip');
 b.soundWet=wet;
 const stride=Math.floor(b.runCycle||0);
 if(stride!==(b.soundStride??stride) && c.speed>4 && b.stand>.7 && Math.hypot(c.vel.x,c.vel.z)>4)emit(wet?'paddle':'step');
 b.soundStride=stride;
 if(b.state==='rest' && t>=(b.creakAt||0) && b.eyes.some(e=>e.lift>1 && e.prevLift<=1)) {
  emit('creak');b.creakAt=t+8+c.phase;
 }
}
