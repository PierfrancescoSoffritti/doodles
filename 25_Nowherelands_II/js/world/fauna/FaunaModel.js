import { buildLumenGrid } from './LumenFlow.js';
import { Random } from '../../core/Random.js';
import { initializeSchool, updateSchool, swimLumen } from './LumenSchool.js';

export const SPECIES = {
	lumen: { name: 'Lumen shoal', count: 640, cap: 640, speed: 6, height: 13, radius: 42, voice: 'liquid whistles', interval: 12 },
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function habitatScore(kind, s) {
	if (!Number.isFinite(s.ground) || !Number.isFinite(s.water) || s.roof) return -Infinity;
	const depth = s.water - s.ground;
	switch (kind) {
		case 'lumen': return depth > 0.3 ? 2 + Math.min(depth, 12) * 0.04 - s.foam * 3 : s.slope < 0.25 ? 0.2 : -Infinity;
	}
	return -Infinity;
}

// Small CPU simulation; rendering interpolates these fixed-rate snapshots. World time
// acceleration deliberately does not accelerate swimming or the creatures' audio clock.
export class FaunaModel {
	constructor(seed, environment) {
		this.seed = seed; this.environment = environment; this.time = 0;
		this.groups = new Map(); this.creatures = []; this.onCall = () => {}; this.onEscape = () => {};
		this.listener = { x: 0, y: 0, z: 0 }; this.activity = 0; this.wind = { x: 0, z: 0 };
		this.serial = 0;
	}

	addGroup(id, kind, x, z, searchRadius = 110) {
		if (!SPECIES[kind]) return null;
		if (kind === 'lumen') { const flock = [...this.groups.values()].find(g => g.kind === 'lumen'); if (flock) return flock; }
		if (this.groups.has(id)) return this.groups.get(id);
		const def = SPECIES[kind], available = def.cap - this.creatures.filter(c => c.kind === kind).length;
		if (available <= 0) return null;
		const rnd = new Random(`${this.seed}:fauna:${id}`);
		let best = null, score = -Infinity;
		for (let i = 0; i < 70; i++) {
			const angle = rnd.range(0, Math.PI * 2), r = Math.sqrt(rnd.next()) * searchRadius;
			const px = x + Math.cos(angle) * r, pz = z + Math.sin(angle) * r;
			const s = this.environment.sample(px, pz), value = habitatScore(kind, s) - r / searchRadius * 0.15;
			if (value > score) { score = value; best = { x: px, z: pz, sample: s }; }
		}
		if (!best) return null;
		const home = { x: best.x, y: Math.max(best.sample.ground, best.sample.water) + def.height, z: best.z };
		const group = { id, kind, home, phase: rnd.range(0, 6.28), nextCall: this.time + rnd.range(3, def.interval), members: [], responseUntil: 0, rnd, target: { ...home }, targetUntil: 0 };
		for (let i = 0; i < Math.min(def.count, available); i++) {
			const angle = i * 2.39996323 + group.phase;
			const r = Math.sqrt((i + 0.5) / def.count) * 19;
			let px = home.x + Math.cos(angle) * r, pz = home.z + Math.sin(angle) * r;
			let sample = this.environment.sample(px, pz);
			if (habitatScore(kind, sample) === -Infinity) { px = home.x; pz = home.z; sample = best.sample; }
			const size = rnd.range(0.8, 1.2);
			const py = Math.max(sample.ground, sample.water) + def.height + rnd.range(-3, 3);
			// Keep the established seed draw order so existing worlds retain their shoals.
			const c = { id: `${id}:${i}`, kind, group, pos: { x: px, y: py, z: pz }, prev: { x: px, y: py, z: pz },
				vel: { x: Math.cos(angle) * def.speed, y: 0, z: Math.sin(angle) * def.speed }, size,
				phase: rnd.range(0, 6.28), temperament: rnd.next(), voice: rnd.range(-14, 14), degree: rnd.int(0, 4),
				energy: 0, responseAt: Infinity, responseStrength: 0, callAt: Infinity, nextHear: 0, calls: 0,
				yaw: -angle, bank: 0, bend: 0, gait: rnd.next(), speed: def.speed, ground: sample.ground,
				water: sample.water, floorTimer: rnd.range(0, 0.3), hop: 0, hopWait: rnd.range(1, 6),
				attention: null, attentionUntil: 0, resting: false, feet: null,
				rnd: new Random(`${this.seed}:${id}:${i}:motion`), target: { x: px, y: py, z: pz }, targetUntil: 0,
				stroke: rnd.range(0, 6.28), breath: rnd.range(0, 6.28), effort: 0.5, powered: rnd.chance(0.6), motorTimer: rnd.range(0.5, 3),
				turnRate: 0, pitch: 0, compression: 0, hopState: 'rest', hopTimer: 0, footOrder: 0, restUntil: 0, wander: 0,
				lookPauseUntil: 0, lookAvailableAt: 0 };
			group.members.push(c); this.creatures.push(c);
		}
		if (kind === 'lumen') initializeSchool(group, this.environment, this.time);
		this.groups.set(id, group); return group;
	}

	removeFar(position, radius = 780) {
		for (const [id, group] of this.groups) {
			if (group.kind === 'lumen' && this.environment.lakes?.length) continue;
			if (Math.hypot(group.home.x - position.x, group.home.z - position.z) > radius) this.groups.delete(id);
		}
		this.creatures = this.creatures.filter(c => this.groups.has(c.group.id));
	}

	// A creature voice is never fed back into this external-stimulus path. Each group
	// may answer only once per cooldown; the visual reaction spreads with distance.
	hear({ position, strength = 0.5, layer = '', freq = 400 }) {
		if (layer.startsWith('fauna:')) return;
		const source = position || this.listener;
		for (const group of this.groups.values()) {
			let closest = null, nearest = Infinity;
			for (const c of group.members) {
				const d = distance(c.pos, source);
				if (d > 190 || this.time < c.nextHear) continue;
				const affinity = 0.8;
				const energy = clamp(strength * (1 - d / 190) * affinity, 0, 1);
				if (energy < 0.025) continue;
				c.responseAt = this.time + 0.12 + d / 100 + c.temperament * 0.3;
				c.responseStrength = energy; c.nextHear = this.time + 1.6;
				c.attention = { ...source }; c.attentionUntil = this.time + 3 + c.temperament * 2;
				if (this.time >= c.lookAvailableAt) { c.lookPauseUntil = this.time + 0.7 + c.temperament; c.lookAvailableAt = this.time + 9 + c.temperament * 4; }
				if (d < nearest) { nearest = d; closest = c; }
			}
			if (closest && this.time > group.responseUntil && strength > 0.25) {
				closest.callAt = closest.responseAt + 0.7 + closest.temperament;
				group.responseUntil = this.time + 6;
			}
		}
	}

	call(c) {
		if (!c) return;
		c.energy = Math.max(c.energy, 0.85); c.calls++;
		this.onCall(c);
		if (c.kind === 'lumen') {
			for (const other of c.group.members) if (other !== c) {
				other.responseAt = this.time + distance(c.pos, other.pos) / 24 + 0.1;
				other.responseStrength = 0.5;
			}
		}
	}

	step(dt) {
		this.time += dt;
		for (const group of this.groups.values()) {
			if (group.kind === 'lumen') updateSchool(group, this, dt);
			if (this.time >= group.nextCall && (group.kind==='lumen'?group.members.some(c=>distance(c.pos,this.listener)<160):distance(group.center || group.home, this.listener)<230)) {
				const audible=group.kind==='lumen'?group.members.filter(c=>distance(c.pos,this.listener)<160):group.members;
			audible[group.rnd.int(0,audible.length-1)].callAt=this.time;
				group.nextCall = this.time + SPECIES[group.kind].interval * group.rnd.range(0.8, 1.4);
			}
		}
		// All neighbours are read from one snapshot, so ordering cannot create a leader.
		for (const c of this.creatures) {
			Object.assign(c.prev, c.pos); Object.assign(c, { oldVX: c.vel.x, oldVY: c.vel.y, oldVZ: c.vel.z });
			c.prevStroke = c.stroke; c.prevYaw = c.yaw; c.prevPitch = c.pitch; c.prevBank = c.bank;
		}
		for(const group of this.groups.values())if(group.kind==='lumen')buildLumenGrid(group);
		for (const c of this.creatures) {
			const t = this.time, p = c.pos;
			c.energy *= Math.exp(-dt * 1.5);
			if (t >= c.responseAt) { c.energy = Math.max(c.energy, c.responseStrength); c.responseAt = Infinity; }
			if (t >= c.callAt) { c.callAt = Infinity; this.call(c); }
			c.floorTimer -= dt;
			if (c.floorTimer <= 0) {
				const s = this.environment.sample(p.x, p.z); c.ground = s.ground; c.water = s.water;
				c.floorTimer = 0.18 + c.temperament * 0.1;
			}
			swimLumen(c, this, dt);
		}
	}
}
