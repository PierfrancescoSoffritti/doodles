// Locomotion runs on the fixed simulation clock. The GPU receives continuous
// stroke phases and muscle effort, never time multiplied by a changing frequency.
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const smooth = t => t * t * (3 - 2 * t);

// Veil-ray powered strokes alternate with glides.
export function motor(c, dt, fleeing = false) {
	c.motorTimer -= dt;
	if (c.motorTimer <= 0) {
		c.powered = !c.powered;
		const r = c.rnd;
		c.motorTimer = c.powered ? r.range(5, 9) : r.range(2, 4);
	}
	const demand = c.powered ? 0.72 : 0.16;
	c.effort = damp(c.effort, fleeing ? 1 : Math.min(1, demand + c.energy * 0.22 + Math.abs(c.turnRate) * 0.2), 3.5, dt);
	const hz = 0.15 + c.effort * 0.24;
	c.stroke += dt * hz * Math.PI * 2;
	c.breath += dt * (0.95 + c.temperament * 0.4);
}

export function steer(c, dx, dz, desiredSpeed, maxTurn, dt) {
	const target = Math.atan2(-dz, dx), error = angleDelta(target, c.yaw);
	c.turnRate = damp(c.turnRate, clamp(error * 2, -maxTurn, maxTurn), 3, dt);
	c.yaw += c.turnRate * dt;
	// Turn into a new direction before applying thrust: no sideways skating.
	const turnBrake = Math.max(0.3, Math.cos(Math.min(Math.abs(error), 1.3)));
	c.speed = damp(c.speed, desiredSpeed * turnBrake, desiredSpeed > c.speed ? 1.5 : 1.1, dt);
	c.vel.x = Math.cos(c.yaw) * c.speed; c.vel.z = -Math.sin(c.yaw) * c.speed;
	c.bank = damp(c.bank, clamp(c.turnRate * c.speed * 0.065, -0.65, 0.65), 3, dt);
	c.bend = damp(c.bend, clamp(c.turnRate * 0.7, -0.7, 0.7), 4, dt);
}
