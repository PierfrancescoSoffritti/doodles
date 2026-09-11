import { receiveNote, updateNote, isPlayerNote } from './NoteResponse.js?v=player-notes-13';
import { initializeWorldRays, updateWorldRays, hearWorldRays, worldRayCall } from './VeilRayWorld.js?v=player-notes-13';
import { initializePebbles, pebbleHabitat, updatePebble, answerPebble } from './PebbleHoppers.js?v=player-notes-13';
import { buildLumenGrid } from './LumenFlow.js';
import { Random } from '../../core/Random.js';
import { motor, steer, damp } from './Locomotion.js';
import { initializeSchool, updateSchool, swimLumen } from './LumenSchool.js?v=player-notes-13';

export const SPECIES = {
	lumen: { name: 'Lumen shoal', count: 640, cap: 640, speed: 6, height: 13, radius: 42, voice: 'liquid whistles', interval: 12 },
	hopper: { name: 'Pebble hoppers', count: 4, cap: 24, speed: 0, height: 1.4, radius: 12, voice: 'quiet stone ticks', interval: 40 },
	ray: { name: 'Veil rays', count: 1, cap: 5, speed: 2.8, height: 6, radius: 28, voice: 'hollow singing calls', interval: 27 },
};
export const PEBBLE_DRAW_DISTANCE = 650;
// Habitat stones stay at home, but a fleeing animal may travel far beyond it.
function groupDistance(group, position) {
 let nearest = Math.hypot(group.home.x - position.x, group.home.z - position.z);
 for (const c of group.members) nearest = Math.min(nearest, Math.hypot(c.pos.x - position.x, c.pos.z - position.z));
 return nearest;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function habitatScore(kind, s) {
	if (!Number.isFinite(s.ground) || !Number.isFinite(s.water) || s.roof) return -Infinity;
	const depth = s.water - s.ground;
	switch (kind) {
		case 'lumen': return depth > 0.3 ? 2 + Math.min(depth, 12) * 0.04 - s.foam * 3 : s.slope < 0.25 ? 0.2 : -Infinity;
		case 'ray': return depth > 0.4 && s.foam < 0.25 ? 2 + Math.min(depth, 15) * 0.05 : -Infinity;
		case 'hopper': return pebbleHabitat(s);
	}
	return -Infinity;
}

// Small CPU simulation; rendering interpolates these fixed-rate snapshots. World time
// acceleration deliberately does not accelerate swimming or the creatures' audio clock.
export class FaunaModel {
	constructor(seed, environment) {
		this.seed = seed; this.environment = environment; this.time = 0;
		this.groups = new Map(); this.creatures = []; this.onCall = () => {}; this.onEscape = () => {}; this.onPebbleSound = () => {};
		this.listener = { x: 0, y: 0, z: 0 }; this.activity = 0; this.wind = { x: 0, z: 0 };
		this.serial = 0;
	}

	addGroup(id, kind, x, z, searchRadius = 110, options = {}) {
		if (!SPECIES[kind]) return null;
		if (kind === 'ray' && this.environment.raySites && !options.raySite) return null;
		const sampleAt = options.sample || this.environment.sample;
		if (kind === 'lumen') { const flock = [...this.groups.values()].find(g => g.kind === 'lumen'); if (flock) return flock; }
		if (this.groups.has(id)) return this.groups.get(id);
		const def = SPECIES[kind], available = def.cap - this.creatures.filter(c => c.kind === kind).length;
		if (available <= 0) return null;
		const rnd = new Random(`${this.seed}:fauna:${id}`);
		let best = null, score = -Infinity;
		for (let i = 0; i < 70; i++) {
			const angle = rnd.range(0, Math.PI * 2), r = Math.sqrt(rnd.next()) * searchRadius;
			const px = x + Math.cos(angle) * r, pz = z + Math.sin(angle) * r;
			const s = sampleAt(px, pz), value = habitatScore(kind, s) - r / searchRadius * 0.15;
			if (value > score) { score = value; best = { x: px, z: pz, sample: s }; }
		}
		if (options.raySite) { const site=options.raySite; best={x:site.x,z:site.z,sample:sampleAt(site.x,site.z)}; }
		if (!best) return null;
		const groundKind = kind === 'hopper';
		const home = { x: best.x, y: (groundKind ? best.sample.ground : Math.max(best.sample.ground, best.sample.water)) + def.height, z: best.z };
		const group = { id, kind, home, phase: rnd.range(0, 6.28), nextCall: this.time + rnd.range(3, def.interval), members: [], responseUntil: 0, rnd, target: { ...home }, targetUntil: 0, sample: options.sample, habitat: options.habitat };
		const count = options.raySite?.count || (kind === 'hopper' ? rnd.int(3, 6) : def.count);
		for (let i = 0; i < Math.min(count, available); i++) {
			const angle = kind === 'lumen' ? i * 2.39996323 + group.phase : rnd.range(0, Math.PI * 2);
			const r = kind === 'lumen' ? Math.sqrt((i + 0.5) / def.count) * 19 : rnd.range(2, def.radius * 0.65);
			let px = home.x + Math.cos(angle) * r, pz = home.z + Math.sin(angle) * r;
			let sample = sampleAt(px, pz);
			if (habitatScore(kind, sample) === -Infinity) { px = home.x; pz = home.z; sample = best.sample; }
			// Keep the established seed draw order so existing worlds retain their shoals.
			const size = kind === 'hopper' ? rnd.range(0.75, 1.8) : rnd.range(0.8, 1.2);
			const py = (groundKind ? sample.ground : Math.max(sample.ground, sample.water)) + def.height * (groundKind ? size : 1) + (kind === 'lumen' ? rnd.range(-3, 3) : 0);
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
		if (options.raySite) initializeWorldRays(group, this, options.raySite);
		if (kind === 'lumen') initializeSchool(group, this.environment, this.time);
		if (kind === 'hopper') { initializePebbles(group, this); if (!group.members.length) return null; }
		this.groups.set(id, group); return group;
	}

	removeFar(position, radius = 780) {
		for (const [id, group] of this.groups) {
			if (group.kind === 'lumen' && this.environment.lakes?.length) continue;
			if (groupDistance(group, position) > radius) this.groups.delete(id);
		}
		this.creatures = this.creatures.filter(c => this.groups.has(c.group.id));
	}

 // Streaming can defer a new colony when the population cap is occupied by
 // visible animals. Never evict a chase to make room for an upcoming site.
 reservePebbleSpace(position, count = 3) {
  let available = SPECIES.hopper.cap - this.creatures.filter(c => c.kind === 'hopper').length;
  if (available >= count) return true;
  const candidates = [...this.groups.values()].filter(g => g.kind === 'hopper')
   .map(group => ({ group, distance: groupDistance(group, position) }))
   .filter(c => c.distance > PEBBLE_DRAW_DISTANCE).sort((a,b) => b.distance-a.distance);
  if (available + candidates.reduce((n,c) => n+c.group.members.length,0) < count) return false;
  for (const {group} of candidates) {
   this.groups.delete(group.id); available += group.members.length;
   if (available >= count) break;
  }
  this.creatures = this.creatures.filter(c => this.groups.has(c.group.id));
  return true;
 }

	// A creature voice is never fed back into this external-stimulus path. Each group
	// may answer only once per cooldown; the visual reaction spreads with distance.
	hear({ position, strength = 0.5, layer = '', freq = 400, radius }) {
		if (layer.startsWith('fauna:')) return;
		const source = position || this.listener;
		for (const group of this.groups.values()) {
			if (group.raySite) { hearWorldRays(group,this,{position:source,strength,layer,radius}); continue; }
			if(isPlayerNote({layer})){
				const near=group.members.filter(c=>(radius!==undefined?Math.hypot(c.pos.x-source.x,c.pos.z-source.z):distance(c.pos,source))<=(radius??(strength>.75?165:110))).sort((a,b)=>distance(a.pos,source)-distance(b.pos,source));
				near.forEach((c,i)=>{if(receiveNote(c,this.time,{layer,position:source,velocity:strength,radius},{delay:Math.min(1.3,i*.075),duration:5,range:110}))c.noteSpeak=group.kind==='hopper'||i<3;});
				continue;
			}
			let closest = null, nearest = Infinity;
			for (const c of group.members) {
				const d = distance(c.pos, source);
				if (d > 190 || this.time < c.nextHear) continue;
				if (c.kind === 'hopper') {
					// Footfalls reinforce nearby danger; ambient music never schedules a
					// conspicuous call or an endless series of frozen listening poses.
					if (layer === 'footstep' && !this.observing && d < 13 && ['rest', 'notice'].includes(c.pebble.state) && this.time > c.pebble.retryAt) {
						c.pebble.alarmAt = Math.min(c.pebble.alarmAt, this.time + 0.12 + c.temperament * 0.1);
						c.pebble.alarmSource = { ...source };
					}
					continue;
				}
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
		if (c.group.raySite) return worldRayCall(c,this);
		c.energy = Math.max(c.energy, 0.85); c.calls++;
		this.onCall(c);
		if (c.kind === 'lumen') {
			for (const other of c.group.members) if (other !== c) {
				other.responseAt = this.time + distance(c.pos, other.pos) / 24 + 0.1;
				other.responseStrength = 0.5;
			}
		}
	}

	chooseTarget(owner, kind, radius) {
		const home = owner.home || owner.group.home, r = owner.rnd;
		for (let attempt = 0; attempt < 18; attempt++) {
			const angle = r.range(0, Math.PI * 2), reach = Math.sqrt(r.next()) * radius;
			const x = home.x + Math.cos(angle) * reach, z = home.z + Math.sin(angle) * reach;
			const surface = this.environment.sample(x, z);
			if (habitatScore(kind, surface) > 0) {
				owner.target = { x, z, y: Math.max(surface.ground, surface.water) + SPECIES[kind].height + r.range(-2, 2) };
				break;
			}
		}
		owner.targetUntil = this.time + r.range(7, 17);
	}

	step(dt) {
		if (dt <= 0) return;
		this.time += dt;
		const oldListener = this.previousListener || this.listener;
		const dx = this.listener.x - oldListener.x, dz = this.listener.z - oldListener.z;
		const teleported = Math.hypot(dx, dz) > 60;
		this.listenerVelocity = { x: teleported ? 0 : dx / dt, z: teleported ? 0 : dz / dt };
		this.previousListener = { ...this.listener };
		for (const group of this.groups.values()) {
			if (group.kind === 'lumen') updateSchool(group, this, dt);
			if (!group.raySite && group.kind !== 'hopper' && this.time >= group.nextCall && (group.kind==='lumen'?group.members.some(c=>distance(c.pos,this.listener)<160):distance(group.center || group.home, this.listener)<230)) {
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
		for(const group of this.groups.values()) {
			if(group.kind==='lumen')buildLumenGrid(group);
			if(group.raySite)updateWorldRays(group,this,dt);
		}
		for (const c of this.creatures) {
			if(c.group.raySite) continue;
			updateNote(c,this.time,r=>{if(c.kind==='hopper')answerPebble(c,this,r);},r=>{if(c.noteSpeak)this.onNoteReply?.(c.kind,c,r.alarm);});
			const def = SPECIES[c.kind], t = this.time, p = c.pos, home = c.group.home;
			c.energy *= Math.exp(-dt * (c.kind === 'ray' ? 0.6 : 1.5));
			if (t >= c.responseAt) { c.energy = Math.max(c.energy, c.responseStrength); c.responseAt = Infinity; }
			if (t >= c.callAt) { c.callAt = Infinity; this.call(c); }
			c.floorTimer -= dt;
			if (c.floorTimer <= 0) {
				const s = (c.group.sample || this.environment.sample)(p.x, p.z); c.ground = s.ground; c.water = s.water;
				c.floorTimer = 0.18 + c.temperament * 0.1;
			}
			if (c.kind === 'lumen') { swimLumen(c, this, dt); continue; }
			if (c.kind === 'hopper') { updatePebble(c, this, dt); continue; }
			const playerDistance = distance(p, this.listener), fleeing = playerDistance < 10;
			motor(c, dt, fleeing);
			if (t > c.targetUntil || Math.hypot(p.x - c.target.x, p.z - c.target.z) < 2.5) {
				this.chooseTarget(c, c.kind, def.radius);
			}
			const target = c.target;
			let dx = target.x - p.x, dz = target.z - p.z;
			const length = Math.hypot(dx, dz) || 1; dx /= length; dz /= length;
			// Correlated wander changes slowly; it never snaps to a new random heading.
			c.wander = damp(c.wander, c.rnd.range(-1, 1), 0.7, dt);
			dx += Math.sin(c.yaw) * c.wander * 1.5; dz += Math.cos(c.yaw) * c.wander * 1.5;
			const listening = c.attention && t < c.attentionUntil;
			if (listening && !fleeing) {
				const ax = c.attention.x - p.x, az = c.attention.z - p.z, al = Math.hypot(ax, az) || 1;
				dx += ax / al * 0.55; dz += az / al * 0.55;
			}
			if (fleeing) {
				dx += (p.x - this.listener.x) / Math.max(playerDistance, 0.1) * 4;
				dz += (p.z - this.listener.z) / Math.max(playerDistance, 0.1) * 4;
			}
			const homeDistance = Math.hypot(p.x - home.x, p.z - home.z);
			if (homeDistance > def.radius + 14) { dx += (home.x - p.x) / homeDistance * 3; dz += (home.z - p.z) / homeDistance * 3; }
			const avoid = this.environment.avoid?.({ x: p.x + c.vel.x * 1.4, y: p.y, z: p.z + c.vel.z * 1.4 }, c.kind);
			if (avoid) { dx += avoid.x; dz += avoid.z; }
			const ahead = this.environment.sample(p.x + c.vel.x * 2.5, p.z + c.vel.z * 2.5);
			if (habitatScore(c.kind, ahead) === -Infinity) { dx = home.x - p.x; dz = home.z - p.z; }
			const speedFactor = 0.6 + c.effort * 0.7;
			const speed = def.speed * (0.86 + c.temperament * 0.22) * speedFactor * (fleeing ? 1.35 : 1);
			steer(c, dx, dz, speed, 0.38, dt);
			let nx = p.x + c.vel.x * dt, nz = p.z + c.vel.z * dt;
			const s = this.environment.sample(nx, nz);
			if (habitatScore(c.kind, s) === -Infinity) { nx = p.x; nz = p.z; c.speed *= 0.5; c.targetUntil = 0; }
			else { c.ground = s.ground; c.water = s.water; }
			p.x = nx; p.z = nz;
			c.gait += Math.hypot(p.x - c.prev.x, p.z - c.prev.z) / 4;
			const floor = Math.max(c.ground, c.water);
			// Altitude follows a slowly varying goal and lift, not a global sine bob.
			const targetY = floor + def.height;
			const lift = Math.sin(c.stroke - 0.8) * c.effort * 0.15;
			c.vel.y += clamp((targetY - p.y) * 1.8 - c.vel.y * 2.6 + lift, -10, 10) * dt;
			p.y = Math.max(floor + 1.5, p.y + c.vel.y * dt);
			c.pitch = damp(c.pitch, clamp(Math.atan2(c.vel.y, Math.max(c.speed, 1)), -0.32, 0.32), 3, dt);
		}
	}

}

// Knee in a plane chosen by bendDirection. The target is clamped to reachable
// distance, including a zero-distance guard, so uneven ground never creates NaNs.
export function solveLeg(hip, target, length, bendDirection) {
	let dx = target.x - hip.x, dy = target.y - hip.y, dz = target.z - hip.z;
	const actual = Math.hypot(dx, dy, dz);
	if (actual < 1e-5) { dx = 0; dy = -1; dz = 0; } else { dx /= actual; dy /= actual; dz /= actual; }
	const d = Math.min(Math.max(actual, 0.001), length * 2 * 0.999);
	const dot = bendDirection.x * dx + bendDirection.y * dy + bendDirection.z * dz;
	let bx = bendDirection.x - dx * dot, by = bendDirection.y - dy * dot, bz = bendDirection.z - dz * dot;
	let bl = Math.hypot(bx, by, bz);
	if (bl < 1e-5) { bx = -dy; by = dx; bz = 0; bl = Math.hypot(bx, by); if (bl < 1e-5) { bx = 1; bl = 1; } }
	const h = Math.sqrt(Math.max(0, length * length - d * d * 0.25));
	return { knee: { x: hip.x + dx * d * 0.5 + bx / bl * h, y: hip.y + dy * d * 0.5 + by / bl * h, z: hip.z + dz * d * 0.5 + bz / bl * h },
		foot: { x: hip.x + dx * d, y: hip.y + dy * d, z: hip.z + dz * d } };
}
