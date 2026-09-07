import { Random } from '../../core/Random.js';
import { angleDelta, clamp, damp } from './Locomotion.js';

// A separate random stream keeps curiosity from changing placement or escape routes.
export function initializePebbleEyes(c, time) {
	const rnd = new Random(`pebble-eyes:${c.id}:${c.phase}`);
	c.pebble.eyes = [0, 1].map(j => {
		const yaw = rnd.range(-0.5, 0.5), extension = rnd.range(0.38, 0.58);
		return { rnd, yaw, prevYaw: yaw, pitch: 0.16, prevPitch: 0.16,
			extension, prevExtension: extension, targetYaw: yaw, targetPitch: 0.16,
			nextLook: time + rnd.range(0.5, 3) + j * 0.4, peekUntil: time,
			phase: rnd.range(0, Math.PI * 2), attention: 0, prevAttention: 0, dilation: 0, prevDilation: 0, proximity: 0, prevProximity: 0 };
	});
}

export function updatePebbleEyes(c, model, dt) {
	const b = c.pebble, dx = model.listener.x - c.pos.x, dz = model.listener.z - c.pos.z;
	const distance = Math.hypot(dx, dz);
	const nearby = distance < 27; // Proximity changes the pose, never who they look at.
	const fleeing = b.state === 'rise' || b.state === 'flee' || b.state === 'brake';
	const cautious = model.time < b.calmAt;
	for (let j = 0; j < 2; j++) {
		const e = b.eyes[j];
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
		const extension = fleeing ? 0.06 : b.state === 'settle' ? 0.2 : nearby ? 0.96 : peek ? 0.88 : cautious ? 0.58 : 0.4;
		e.extension = damp(e.extension, extension, fleeing ? 17 : 2.8 + j * 0.5, dt);
	}
}
