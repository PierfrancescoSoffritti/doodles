import { Random } from '../../core/Random.js';
import { angleDelta, clamp, damp, smooth } from './Locomotion.js';

// A separate random stream keeps curiosity from changing placement or escape routes.
export function initializePebbleEyes(c, time) {
	const shape = new Random(`pebble-eye-shape:${c.id}:${c.phase}`);
 const radiusScale = shape.range(.75,1.35), lengthScale = shape.range(.7,1.4);
	c.pebble.eyes = [0, 1].map(j => {
		const rnd = new Random(`pebble-eye:${c.id}:${c.phase}:${j}`);
		const yaw = rnd.range(-0.5, 0.5), extension = rnd.range(0.38, 0.58);
		return { rnd, radiusScale: radiusScale * shape.range(.96,1.04), lengthScale: lengthScale * shape.range(.93,1.07),
   blink:0, prevBlink:0, blinkStart:-Infinity, blinkDuration:.22, nextBlink:time+rnd.range(2.5,6)+j,
   lift:0, prevLift:0, escape:0, prevEscape:0, yaw, prevYaw: yaw, pitch: 0.16, prevPitch: 0.16,
			extension, prevExtension: extension, targetYaw: yaw, targetPitch: 0.16,
			nextLook: time + rnd.range(0.5, 3) + j * 0.4, peekUntil: time,
			phase: rnd.range(0, Math.PI * 2), attention: 0, prevAttention: 0, dilation: 0, prevDilation: 0, proximity: 0, prevProximity: 0 };
	});
}

export function updatePebbleEyes(c, model, dt) {
	const b = c.pebble, dx = model.listener.x - c.pos.x, dz = model.listener.z - c.pos.z;
	const distance = Math.hypot(dx, dz);
	const nearby = distance < 27; // Proximity changes the pose, never who they look at.
	const fleeing = b.state === 'rise' || b.state === 'flee' || b.state === 'brake' || b.state === 'regroup';
	const cautious = model.time < b.calmAt;
	for (let j = 0; j < 2; j++) {
		const e = b.eyes[j];
		e.prevBlink=e.blink; e.prevLift=e.lift; e.prevEscape=e.escape;
  e.escape=damp(e.escape,fleeing?1:0,8,dt);
  e.lift=damp(e.lift, !fleeing ? Math.sin(model.time*(.65+j*.07)+e.phase)*1.2 : 0, 4, dt);
  if(model.time>=e.nextBlink) {
   const other=b.eyes[1-j];
   if(model.time-other.blinkStart<other.blinkDuration+.2)e.nextBlink=model.time+.4;
   else {e.blinkStart=model.time;e.blinkDuration=e.rnd.range(.2,.28);e.nextBlink=model.time+e.rnd.range(3.5,8);}
  }
  const blinkTime=(model.time-e.blinkStart)/e.blinkDuration;
  e.blink=blinkTime<.3?smooth(clamp(blinkTime/.3,0,1)):1-smooth(clamp((blinkTime-.3)/.7,0,1));
		e.prevYaw = e.yaw; e.prevPitch = e.pitch; e.prevExtension = e.extension; e.prevAttention = e.attention; e.prevDilation = e.dilation; e.prevProximity = e.proximity;
		e.proximity = damp(e.proximity, clamp((38 - distance) / 28, 0, 1), 3.5, dt);
		e.dilation = damp(e.dilation, clamp((48 - distance) / 40, 0, 1), 4, dt);
		if (model.time >= e.nextLook) {
			e.targetYaw = e.rnd.range(-1.45, 1.45); e.targetPitch = e.rnd.range(-0.06, 0.42);
			e.peekUntil = model.time + e.rnd.range(0.7, 1.6);
			e.nextLook = model.time + e.rnd.range(cautious ? 1.1 : 2.6, cautious ? 2.5 : 6.5);
		}
		e.attention = damp(e.attention, 1, 8 - j * 2, dt);
		// World forward is (cos(yaw), -sin(yaw)); eye yaw is local toward +Z.
		const threatYaw = angleDelta(Math.atan2(dz, dx) + c.yaw, 0);
		const threatPitch = clamp(Math.atan2(model.listener.y - c.pos.y, Math.max(distance, 0.01)), -1.48, 1.48);
		const targetYaw = threatYaw;
		e.yaw += angleDelta(targetYaw, e.yaw) * (1 - Math.exp(-(fleeing ? 12 : 5 + j) * dt));
		e.pitch = damp(e.pitch, threatPitch, 10, dt);
		const peek = model.time < e.peekUntil;
		const extension = fleeing ? 1 : b.state === 'settle' ? 0.2 : nearby ? 0.96 : peek ? 0.88 : cautious ? 0.58 : 0.4;
		e.extension = damp(e.extension, extension, fleeing ? 17 : 2.8 + j * 0.5, dt);
	}
}
