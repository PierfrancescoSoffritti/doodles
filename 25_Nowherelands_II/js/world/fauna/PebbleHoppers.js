import { initializePebbleEyes, updatePebbleEyes } from './PebbleEyes.js?v=pebble-perf-2';
import { angleDelta, clamp, damp, smooth } from './Locomotion.js';

// World units are roughly five times human scale. The eye is eleven units up;
// proximity must be measured on the ground, with a separate height gate.
export const PEBBLE_REST_HEIGHT = 0.55;
const TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;
const flatDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function pebbleHabitat(s) {
	const height = s.ground - s.water, hard = s.hardness ?? 0.65;
	if (s.roof || !Number.isFinite(height) || height < 0.7 || !Number.isFinite(s.slope) || (s.clearance ?? Infinity) < 3.5 || s.slope > (s.cave ? 0.55 : 0.34) || s.forest > 0.65 || s.wet > 0.9 || hard < 0.38) return -Infinity;
	const gravel = height < 5 && hard > 0.45 ? 1 : 0;
	const foothill = smooth(clamp(s.slope / 0.18, 0, 1)) * hard;
	return (s.cave ? 2 : 0.3) + hard * 1.6 + foothill * 1.6 + gravel * 0.7 + (1 - s.wet) * 0.7 - s.forest * 1.8;
}

function traversable(s) {
	return Number.isFinite(s.ground) && Number.isFinite(s.water) && !s.roof && s.ground - s.water > 0.45 && (s.clearance ?? Infinity) >= 3.5 && s.slope < (s.cave ? 0.6 : 0.4);
}

// Sample a body-sized footprint, not just its centre. A dry destination on the
// opposite bank is not a valid route across water, a cliff, or a boulder.
export function pebbleGround(model, x, z, size, originY) {
	const sample = model.environment.sample, center = sample(x, z);
	if (!traversable(center) || (originY !== undefined && Math.abs(center.ground - originY) > (center.cave ? 0.8 : 0.65) * size)) return null;
	for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
		const s = sample(x + dx * size * 1.25, z + dz * size * 1.25);
		if (!traversable(s) || Math.abs(s.ground - center.ground) > (center.cave ? 0.8 : 0.65) * size) return null;
	}
	if (model.environment.blocked?.(x, z, size * 1.35, center.ground)) return null;
	return center;
}

export function pebbleSlope(sample, x, z, yaw, size) {
	const co = Math.cos(yaw), si = Math.sin(yaw), r = size * 1.1;
	const fore = sample(x + co * r, z - si * r).ground, rear = sample(x - co * r, z + si * r).ground;
	const right = sample(x + si * r, z + co * r).ground, left = sample(x - si * r, z - co * r).ground;
	return { pitch: clamp(Math.atan2(fore - rear, r * 2), -0.35, 0.35), bank: clamp(-Math.atan2(right - left, r * 2), -0.35, 0.35) };
}

function hasRunway(model, x, z, size) {
	for (let j = 0; j < 12; j++) {
		const angle = j * TAU / 12; let ground = model.environment.sample(x, z).ground, clear = true;
		for (let i = 1; i <= 8; i++) {
			const s = pebbleGround(model, x + Math.cos(angle) * i, z + Math.sin(angle) * i, size, ground);
			if (!s) { clear = false; break; } ground = s.ground;
		}
		if (clear) return true;
	}
	return false;
}

export function initializePebbles(group, model) {
	const owner = model;
	if (group.sample) model = { ...model, environment: { ...model.environment, sample: group.sample } };
	const r = group.rnd, placed = [];
	for (const c of group.members) {
		let spot = null;
		for (let i = 0; i < 60; i++) {
			const a = r.range(0, TAU), reach = r.range(0, 13);
			const x = group.home.x + Math.cos(a) * reach, z = group.home.z + Math.sin(a) * reach;
			const s = pebbleGround(model, x, z, c.size);
			if (!s || pebbleHabitat(s) <= 0 || (group.sample && !hasRunway(model, x, z, c.size)) || placed.some(o => Math.hypot(x - o.pos.x, z - o.pos.z) < (c.size + o.size) * 1.8)) continue;
			spot = { x, z, y: s.ground + PEBBLE_REST_HEIGHT * c.size }; c.ground = s.ground; c.water = s.water; break;
		}
		if (!spot) continue;
		c.pos = spot; c.prev = { ...spot }; c.prevYaw = c.yaw; c.resting = true;
		const slope = pebbleSlope(model.environment.sample, spot.x, spot.z, c.yaw, c.size);
		c.pitch = c.prevPitch = slope.pitch; c.bank = c.prevBank = slope.bank;
		c.pebble = { state: 'rest', timer: 0, stand: 0, prevStand: 0, alarmAt: Infinity, alarmSource: null,
			idleAt: model.time + c.rnd.range(8, 24), idleTime: -1, idleSign: c.rnd.chance(0.5) ? 1 : -1,
			refuge: null, planAt: 0, nextStep: 0, nextFoot: c.rnd.int(0, 1), steps: 0, yVelocity: 0,
			scatter: (group.members.indexOf(c) / Math.max(1, group.members.length - 1) - 0.5) * 4.2 + c.rnd.range(-0.1, 0.1),
			calmAt: 0, retryAt: 0, escapes: 0, restPitch: slope.pitch, restBank: slope.bank };
		initializePebbleEyes(c, model.time);
		placed.push(c);
	}
	const rejected = new Set(group.members.filter(c => !placed.includes(c)));
	owner.creatures = model.creatures.filter(c => !rejected.has(c)); group.members = placed;
	group.stones = [];
	// Caves already contain baked rubble. Adding another ring of scenery rocks
	// would close the narrow dry shelves that these small animals use to escape.
	if (group.sample) {
		group.members = group.members.filter(c => caveShelfExit(c, model, c.pos));
		owner.creatures = owner.creatures.filter(c => c.group !== group || group.members.includes(c));
		return;
	}
	// Ordinary stones share the animals' geometry and rock material. They remain
	// at home when the animals flee, so the illusion survives the reveal.
	for (let i = 0; i < 90 && group.stones.length < Math.min(16, placed.length * 4); i++) {
		const a = r.range(0, TAU), radius = Math.sqrt(r.next()) * 21, size = r.range(0.45, 1.45);
		const x = group.home.x + Math.cos(a) * radius, z = group.home.z + Math.sin(a) * radius;
		const s = pebbleGround(model, x, z, size);
		if (!s || pebbleHabitat(s) <= 0 || placed.some(c => flatDistance(c.pos, { x, z }) < (size + c.size) * 1.8)
			|| group.stones.some(o => flatDistance(o.pos, { x, z }) < (size + o.size) * 1.7)) continue;
		const yaw = r.range(0, TAU), slope = pebbleSlope(model.environment.sample, x, z, yaw, size);
		group.stones.push({ pos: { x, y: s.ground + PEBBLE_REST_HEIGHT * size, z }, yaw, ...slope, size, phase: r.range(0, TAU) });
	}
}

function clearOfStones(c, p) {
	return !c.group.stones.some(o => flatDistance(o.pos, p) < c.size * 1.35 + o.size * 1.35);
}

// Reuse swept edges while one creature searches its stationary surroundings.
// Moving feet keep fresh terrain checks; no approximate collision samples are used.
function planningModel(model) {
	return model.pebblePlanning ? model : { ...model, pebblePlanning: new Map() };
}

function clearRoute(c, model, p, from = c.pos) {
	const cache = model.pebblePlanning;
	if (!cache) return sweepRoute(c, model, p, from);
	const key = `${from.x},${from.z}:${p.x},${p.z}`;
	if (!cache.has(key)) cache.set(key, sweepRoute(c, model, p, from));
	return cache.get(key);
}

// Let crowded starts move outward through the extra planning margin; the
// movement step still enforces physical separation from every neighbor.
function sweepRoute(c, model, p, from = c.pos) {
	const length = flatDistance(from, p), n = Math.ceil(length / (0.7 * c.size));
	let ground = model.environment.sample(from.x, from.z).ground;
	for (let i = 1; i <= n; i++) {
		const x = mix(from.x, p.x, i / n), z = mix(from.z, p.z, i / n);
		const s = pebbleGround(model, x, z, c.size, ground);
		if (!s || !clearOfStones(c, { x, z }) || c.group.members.some(o => o !== c && flatDistance(o.pos, { x, z }) < (c.size + o.size) * 1.45 && flatDistance(o.pos, { x, z }) <= flatDistance(o.pos, from))) return false;
		ground = s.ground;
	}
	return true;
}

function chooseRefuge(c, model, source, short = false) {
	model = planningModel(model);
	const r = c.rnd, away = Math.atan2(c.pos.z - source.z, c.pos.x - source.x), candidates = [];
	for (let i = 0; i < 22; i++) {
		const a = short && c.group.sample ? r.range(0, TAU) : (c.group.escapeHeading ?? away) + c.pebble.scatter + r.range(short || i >= 16 ? -1.6 : -0.32, short || i >= 16 ? 1.6 : 0.32), reach = short ? r.range(6, 17) : r.range(45, 68);
		candidates.push({ x: c.pos.x + Math.cos(a) * reach, z: c.pos.z + Math.sin(a) * reach });
	}
	for (const rock of short ? c.group.stones : []) {
		const a = Math.atan2(rock.pos.z - source.z, rock.pos.x - source.x), reach = (c.size + rock.size) * 1.7;
		candidates.push({ x: rock.pos.x + Math.cos(a) * reach, z: rock.pos.z + Math.sin(a) * reach });
	}
	let best = null, score = -Infinity; const detours = [], ranked = [];
	for (const p of candidates) {
		const length = flatDistance(c.pos, p), fromThreat = flatDistance(source, p);
		if (length < 4 || length > 75 || fromThreat < flatDistance(source, c.pos) + (short ? 1 : 15)) continue;
		const s = model.environment.sample(p.x, p.z), habitat = pebbleHabitat(s);
		if (habitat <= 0) continue;
		const cover = c.group.stones.reduce((best, rock) => Math.max(best, 2.5 - flatDistance(rock.pos, p) * 0.35), 0);
		const crowd = c.group.members.reduce((sum, o) => sum + (o !== c && flatDistance(o.pebble.refuge || o.pos, p) < 4 ? 5 : 0), 0);
		const heading = Math.atan2(p.z - c.pos.z, p.x - c.pos.x);
		const value = habitat + cover * 0.25 + Math.min(fromThreat, 80) * 0.06 - Math.abs(angleDelta(heading, (c.group.escapeHeading ?? away) + c.pebble.scatter)) * 12 - crowd;
		ranked.push({ p, value });
	}
	// Ranking first preserves the preferred safe destination without sweeping
	// every inferior candidate through dozens of expensive terrain footprints.
	for (const candidate of ranked.sort((a, b) => b.value - a.value)) {
		if (clearRoute(c, model, candidate.p)) { best = candidate.p; score = candidate.value; break; }
		detours.push(candidate);
	}
	if (!best) {
		// A stone or a resting neighbor can block the outward fan. Look for a
		// short dogleg around it instead of freezing or crossing its silhouette.
		const endpoints = detours.sort((a, b) => b.value - a.value).slice(0, 8);
		for (let i = 0; i < 32; i++) {
			const a = away + i * TAU / 16, reach = i < 16 ? 3.5 : 6;
			const via = { x: c.pos.x + Math.cos(a) * reach, z: c.pos.z + Math.sin(a) * reach };
			if (!clearRoute(c, model, via)) continue;
			for (const { p, value } of endpoints) {
				const detourScore = value - (reach + flatDistance(via, p)) * 0.09;
				if (detourScore <= score || !clearRoute(c, model, p, via)) continue;
				score = detourScore; best = { ...p, via };
			}
		}
	}
	if (!best && !short) for (const { p } of detours.sort((a, b) => b.value - a.value).slice(0, c.group.sample ? 1 : 3)) {
		const route = reunionRoute(c, model, p, false);
		if (route) { best = { ...p, via: route.shift(), waypoints: route }; break; }
	}
	if (!best && short && c.group.sample) best = caveShelfExit(c, model, source);
	return best || (!short ? chooseRefuge(c, model, source, true) : null);
}

function caveShelfExit(c, model, source) {
	// Include the placement survey's twelve directions exactly, then resolve the
	// narrow gaps between them. In a cul-de-sac, moving out takes priority over
	// the preferred scatter heading or the preferred resting habitat.
	let best = null, score = -Infinity;
	for (const reach of [8, 12]) for (let i = 0; i < 96; i++) {
		const a = i * TAU / 96, p = { x: c.pos.x + Math.cos(a) * reach, z: c.pos.z + Math.sin(a) * reach };
		const value = flatDistance(p, source) + reach * 0.2;
		if (value > score && clearRoute(c, model, p)) { score = value; best = p; }
	}
	return best;
}

// Regrouping uses the same footprint and swept-route checks as escape. The
// bounded grid is only consulted when a direct return or short dogleg fails.
function reunionRoute(c, model, goal, avoidPlayer = true) {
	const safe = (a, p) => {
		if (avoidPlayer && !model.observing) {
			const dx = p.x - a.x, dz = p.z - a.z, v = model.listener;
			const u = clamp(((v.x - a.x) * dx + (v.z - a.z) * dz) / Math.max(dx * dx + dz * dz, 0.01), 0, 1);
			if (Math.hypot(a.x + dx * u - v.x, a.z + dz * u - v.z) < 20) return false;
		}
		return clearRoute(c, model, p, a);
	};
	if (safe(c.pos, goal)) return [goal];
	for (let j = 0; j < 16; j++) {
		const angle = j * TAU / 16, via = { x: c.pos.x + Math.cos(angle) * 8, z: c.pos.z + Math.sin(angle) * 8 };
		if (safe(c.pos, via) && safe(via, goal)) return [via, goal];
	}
	const start = { x: c.pos.x, z: c.pos.z, ix: 0, iz: 0, cost: 0, parent: null };
	const open = [start], costs = new Map([['0,0', 0]]), spacing = 5;
	for (let visited = 0; open.length && visited < (c.group.sample ? 120 : 360); visited++) {
		open.sort((a, b) => (a.cost + flatDistance(a, goal)) - (b.cost + flatDistance(b, goal)));
		const q = open.shift();
		if (q.cost !== costs.get(`${q.ix},${q.iz}`)) continue;
		if (flatDistance(q, goal) < 10 && safe(q, goal)) {
			const path = [goal]; for (let p = q; p.parent; p = p.parent) path.unshift({ x: p.x, z: p.z }); return path;
		}
		for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
			const ix = q.ix + dx, iz = q.iz + dz, key = `${ix},${iz}`;
			const p = { x: start.x + ix * spacing, z: start.z + iz * spacing, ix, iz, cost: q.cost + Math.hypot(dx, dz) * spacing, parent: q };
			if (p.cost >= (costs.get(key) ?? Infinity) || flatDistance(p, start) > 170 || !safe(q, p)) continue;
			costs.set(key, p.cost); open.push(p);
		}
	}
	return null;
}

function beginRegroup(c, model, t) {
	model = planningModel(model);
	const b = c.pebble, g = c.group;
	b.regroupAt = t + 0.6; // No repeated path searches on the substep clock.
	if (!g.reunion) {
		const center = g.members.reduce((p, o) => ({ x: p.x + o.pos.x / g.members.length, z: p.z + o.pos.z / g.members.length }), { x: 0, z: 0 });
		const candidates = [center, ...g.members.map(o => ({ x: o.pos.x, z: o.pos.z }))];
		for (let i = 0; i < 24; i++) {
			const a = i * TAU / 12, r = i < 12 ? 18 : 36;
			candidates.push({ x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r });
		}
		g.reunion = candidates.filter(p => (model.observing || flatDistance(p, model.listener) > 36) && pebbleGround(model, p.x, p.z, 1.2) && pebbleHabitat(model.environment.sample(p.x, p.z)) > 0)
			.sort((a, d) => flatDistance(a, center) - flatDistance(d, center))[0];
		if (!g.reunion) return;
	}
	if (!model.observing && flatDistance(g.reunion, model.listener) < 28) { g.reunion = null; return; }
	const index = g.members.indexOf(c), angle = index * TAU / g.members.length + g.phase;
	const candidates = [];
	for (let i = 0; i < 36; i++) {
		const a = angle + (i < 18 ? (i % 6 - 2.5) * 0.18 : (i - 18) * TAU / 18), r = i < 18 ? 7 + Math.floor(i / 6) * 4 : 16;
		const p = { x: g.reunion.x + Math.cos(a) * r, z: g.reunion.z + Math.sin(a) * r };
		if (!pebbleGround(model, p.x, p.z, c.size) || !clearOfStones(c, p)) continue;
		if (g.members.some(o => o !== c && flatDistance(o.pebble.regroupTarget || o.pos, p) < (o.size + c.size) * 1.9)) continue;
		candidates.push(p);
	}
	for (const p of candidates.sort((a, d) => flatDistance(a, g.reunion) * 3 + flatDistance(a, c.pos) - flatDistance(d, g.reunion) * 3 - flatDistance(d, c.pos))) {
		if (flatDistance(c.pos, p) < 2) { b.regroupTarget = p; b.reunited = true; change(c, 'wait'); return; }
		const route = reunionRoute(c, model, p); if (!route) continue;
		b.returning = true; b.regroupTarget = p; b.route = route; b.refuge = b.route.shift();
		b.riseFrom = b.stand; b.riseTime = 0.08; b.idleTime = -1; change(c, 'rise'); return;
	}
}

function change(c, state) {
	c.pebble.state = state; c.pebble.timer = 0;
	c.resting = state === 'rest' || state === 'notice';
}

function startle(c, model, source) {
	const b = c.pebble;
	// One alarm wakes the entire colony, including shy or distant members.
	// Broadcast before route planning so a temporarily blocked animal still
	// warns its neighbors. A single encounter cannot re-alarm them after hiding.
	if (!b.groupAlarm && model.time >= (c.group.pebbleAlarmUntil || 0)) {
		c.group.pebbleAlarmUntil = model.time + 0.4;
		const center = c.group.members.reduce((p, o) => ({ x: p.x + o.pos.x / c.group.members.length, z: p.z + o.pos.z / c.group.members.length }), { x: 0, z: 0 });
		c.group.escapeHeading = Math.atan2(center.z - source.z, center.x - source.x);
		c.group.reunionAt = model.time + 2.2; c.group.reunion = null;
		for (const o of c.group.members) { o.pebble.reunited = false; o.pebble.regroupTarget = null; o.pebble.regroupAt = model.time + 2.2 + c.group.members.indexOf(o) * 0.035; }
		for (const o of c.group.members) {
			if (o === c || !['rest', 'notice', 'regroup', 'wait', 'settle'].includes(o.pebble.state) && !o.pebble.returning) continue;
			o.pebble.alarmAt = Math.min(o.pebble.alarmAt, model.time + 0.015 + o.temperament * 0.025 + flatDistance(c.pos, o.pos) * 0.0005);
			o.pebble.alarmSource = { ...source }; o.pebble.groupAlarm = true;
		}
	}
	b.returning = false; b.route = null; b.refuge = chooseRefuge(c, model, source); b.alarmAt = Infinity; b.alarmSource = { ...source };
	if (!b.refuge) { b.retryAt = model.time + (c.group.sample ? 1 : 0.3); b.alarmAt = b.retryAt; b.groupAlarm = true; return; }
	b.groupAlarm = false;
	b.origin = { ...c.pos }; b.escapeStarted = model.time;
	b.blockedCount = 0; b.riseFrom = b.stand; b.riseTime = 0.07 + c.temperament * 0.015;
	b.planAt = model.time + 1; b.calmAt = model.time + 10; b.escapes++; b.idleTime = -1;
	change(c, 'rise');
	if (flatDistance(c.pos, model.listener) < 45) model.onCall(c, true);
}

function footTarget(c, model, j, lead = 0) {
	const side = j ? 1 : -1, co = Math.cos(c.yaw), si = Math.sin(c.yaw);
	const x = (-0.20 + lead) * c.size, z = side * 0.88 * c.size;
	const p = { x: c.pos.x + co * x + si * z, z: c.pos.z - si * x + co * z };
	const s = model.environment.sample(p.x, p.z);
	p.y = s.ground + 0.055 * c.size;
	return traversable(s) && Math.abs(s.ground - c.ground) < 0.8 * c.size ? p : null;
}

function feet(c, model, dt) {
	const b = c.pebble;
	if (!c.feet) c.feet = [0, 1].map(j => {
		const p = footTarget(c, model, j) || { x: c.pos.x, y: c.ground, z: c.pos.z };
		return { pos: p, prev: { ...p }, swing: -1, from: { ...p }, to: { ...p } };
	});
	for (const [index, f] of c.feet.entries()) {
		Object.assign(f.prev, f.pos);
		if (f.swing < 0) continue;
		// An unfolding step may start before the sprint accelerates. Speed up
		// that swing and aim its landing ahead, rather than dragging the planted leg.
		if (c.speed > 1) {
			f.duration = Math.min(f.duration, Math.max(1 / 120, 0.8 * c.size / c.speed));
			const landing = footTarget(c, model, index, clamp(0.35 + c.speed * 0.024 / c.size, 0.35, 1.05));
			if (landing) f.to = landing;
		}
		f.swing = Math.min(1, f.swing + dt / f.duration);
		const u = smooth(f.swing);
		for (const axis of ['x', 'y', 'z']) f.pos[axis] = mix(f.from[axis], f.to[axis], u);
		f.pos.y += Math.sin(Math.PI * f.swing) ** 1.4 * (0.28 + Math.min(c.speed, 12) * 0.018) * c.size;
		if (f.swing >= 1) { f.swing = -1; Object.assign(f.pos, f.to); b.steps++; b.impact = 1; b.nextStep = 0; }
	}
	b.nextStep = Math.min(b.nextStep - dt, c.speed > 1 ? 0.8 * c.size / c.speed : 0.2);
	if (b.stand < 0.65 || b.state === 'settle' || b.state === 'rest' || b.state === 'notice') return;
	if (b.nextStep > 0 || c.feet.some(f => f.swing >= 0)) return;
	const j = b.nextFoot, f = c.feet[j], p = footTarget(c, model, j, clamp(0.35 + c.speed * 0.024 / c.size, 0.35, 1.05));
	if (!p || (c.speed < 0.1 && flatDistance(f.pos, p) < 0.5 * c.size)) return;
	f.from = { ...f.pos }; f.to = p; f.swing = 0;
	f.duration = clamp(0.8 * c.size / Math.max(c.speed, 1), 1 / 120, 0.20);
	b.nextStep = f.duration * (j ? 1 : 1.04); b.nextFoot = 1 - j;
}

function advancePebble(c, model, dt, t) {
	const b = c.pebble, sample = model.environment.sample, before = { ...c.pos };
	b.prevStand = b.stand; b.timer += dt;
	const player = model.listener, dist = flatDistance(c.pos, player);
	const nearby = !model.observing && Math.abs(player.y - c.ground) < 23;
	const pv = model.listenerVelocity || { x: 0, z: 0 };
	const closing = nearby ? clamp(((c.pos.x - player.x) * pv.x + (c.pos.z - player.z) * pv.z) / Math.max(dist, 1), 0, 20) : 0;
	const danger = nearby && dist < 6.5 + c.temperament * 2.5 + closing * 0.28;
	const notice = nearby && dist < 16 + closing * 0.25;
	if (['rest', 'notice'].includes(b.state)) {
		if (notice && b.state === 'rest') { change(c, 'notice'); b.idleTime = -1; }
		if (!notice && b.state === 'notice') change(c, 'rest');
		if (danger && t >= b.retryAt && b.alarmAt === Infinity) {
			b.alarmAt = t + 0.025 + c.temperament * 0.035; b.alarmSource = { ...player }; b.groupAlarm = false;
		}
		if (t >= b.alarmAt && !model.observing) startle(c, model, b.alarmSource || player);
		if (model.observing) b.alarmAt = Infinity;
	}
	if (['regroup', 'wait', 'brake', 'settle'].includes(b.state) && ((['regroup', 'wait'].includes(b.state) && danger && t > b.retryAt) || (!model.observing && t >= b.alarmAt))) startle(c, model, b.alarmSource && t >= b.alarmAt ? b.alarmSource : player);
	if (b.state === 'wait' && !notice && b.alarmAt === Infinity && c.group.reunionAt && t >= c.group.reunionAt && t >= (b.regroupAt || 0) && !b.reunited) beginRegroup(c, model, t);
	if (b.state === 'rise') {
		b.stand = mix(b.riseFrom, 1, smooth(clamp(b.timer / b.riseTime, 0, 1)));
		const goal = b.refuge.via || b.refuge;
		const heading = Math.atan2(-(goal.z - c.pos.z), goal.x - c.pos.x);
		if (b.timer >= b.riseTime && Math.abs(angleDelta(heading, c.yaw)) < 0.2) change(c, b.returning ? 'regroup' : 'flee');
	}
	if (b.state === 'flee') {
		if (danger && closing > 0.5 && t > b.planAt) {
			b.refuge = chooseRefuge(c, model, player) || b.refuge; b.planAt = t + 1;
		}
		if (b.refuge.via && flatDistance(c.pos, b.refuge.via) < 0.7) b.refuge.via = b.refuge.waypoints?.shift() || null;
		if (!b.refuge.via && flatDistance(c.pos, b.refuge) < 3) {
			if (flatDistance(c.pos, b.origin) >= 40 && flatDistance(c.pos, b.alarmSource) >= 42 && !danger) change(c, 'brake');
			else if (t >= (b.refugeRetryAt || 0)) {
				b.refugeRetryAt = t + 0.25;
				const next = chooseRefuge(c, model, b.alarmSource);
				if (next) b.refuge = next;
				else if (t - b.escapeStarted > 8) change(c, 'brake');
			}
		}
	}
	if (b.state === 'regroup') {
		if (flatDistance(c.pos, b.refuge) < (b.route.length ? 1.2 : 1.7)) {
			if (b.route.length) b.refuge = b.route.shift();
			else change(c, 'brake');
		}
		// A player who intercepts the return splits the colony again.
		if (nearby && flatDistance(b.refuge, player) < 20) { b.reunited = false; b.regroupAt = t + 0.6; change(c, 'brake'); }
	}
	if (b.state === 'brake' && c.speed < 0.15 && c.feet?.every(f => f.swing < 0) && b.timer > 0.35) {
		if (b.returning) { b.reunited = flatDistance(c.pos, b.regroupTarget) < 3; b.returning = false; }
		change(c, 'wait');
	}
	// Early arrivals stay upright. Folding is a colony decision, after every
	// member has reached its place; blocked routes keep retrying from this pose.
	if (b.state === 'wait' && b.reunited && c.group.members.every(o => o.pebble.reunited)) {
		b.settleFrom = b.stand; change(c, 'settle');
	}
	if (['settle', 'brake'].includes(b.state) && danger && (closing > 0.5 || dist < 3) && t > b.planAt) startle(c, model, player);
	if (b.state === 'settle') {
		// First pause upright, then lower the weight; toes withdraw only once the
		// stone is supported by the ground. The rigid body never squashes.
		b.stand = b.settleFrom * (1 - smooth(clamp((b.timer - 0.22) / 0.62, 0, 1)));
		if (b.timer >= 1.05) {
			b.stand = 0; b.idleAt = t + c.rnd.range(10, 28); b.retryAt = t + (danger ? 2.5 : 0.45);
			c.feet = null;
			if (b.returning) { b.reunited = flatDistance(c.pos, b.regroupTarget) < 3; b.returning = false; b.regroupAt = t + 0.6; }
			change(c, notice ? 'notice' : 'rest');
			if (dist < 45) model.onCall(c, true);
		}
	}

	const previousSpeed = c.speed, moving = ['flee', 'regroup', 'brake'].includes(b.state);
	if (b.refuge && ['rise', 'flee', 'regroup', 'brake'].includes(b.state)) {
		const goal = b.refuge.via || b.refuge;
		const heading = Math.atan2(-(goal.z - c.pos.z), goal.x - c.pos.x);
		const error = angleDelta(heading, c.yaw), maxTurn = b.state === 'rise' || c.speed < 2 ? 24 : 7;
		const turn = clamp(error * 24, -maxTurn, maxTurn);
		c.yaw += turn * dt; c.turnRate = damp(c.turnRate, turn, 12, dt);
		const cornerBrake = b.refuge.via ? clamp((flatDistance(c.pos, goal) - 0.3) / 8, 0.025, 1) : clamp(flatDistance(c.pos, goal) / 9, 0.22, 1);
		const pace = b.state === 'flee' ? 46 + c.temperament * 10 : b.state === 'regroup' ? 21 + c.temperament * 5 : 0;
		const speed = pace * Math.sqrt(c.size) * Math.max(0, Math.cos(error)) ** 3 * cornerBrake;
		c.speed = damp(c.speed, speed, speed < c.speed ? 22 : 20, dt);
	} else { c.speed = 0; c.turnRate = damp(c.turnRate, 0, 10, dt); }
	if (moving && c.speed > 0.01) {
		const x = c.pos.x + Math.cos(c.yaw) * c.speed * dt, z = c.pos.z - Math.sin(c.yaw) * c.speed * dt;
		const s = pebbleGround(model, x, z, c.size, c.ground);
		const crowded = c.group.members.some(o => o !== c && flatDistance(o.prev, { x, z }) < (c.size + o.size) * 1.3 && flatDistance(o.prev, { x, z }) < flatDistance(o.prev, c.pos));
		if (s && clearOfStones(c, { x, z }) && !crowded) { c.pos.x = x; c.pos.z = z; c.ground = s.ground; c.water = s.water; }
		else {
			c.speed = 0;
			if (b.returning) { b.regroupAt = t + 0.6; change(c, 'brake'); }
			else if (t >= (b.blockedAt || 0)) { b.refuge = chooseRefuge(c, model, player); b.blockedAt = t + 0.15; b.blockedCount++; b.timer = 0; if (b.refuge) { b.riseFrom = b.stand; b.riseTime = 0.08; change(c, 'rise'); } }
			if (!b.refuge) { b.refuge = { x: c.pos.x, z: c.pos.z }; if (t - b.escapeStarted > 8) change(c, 'brake'); }
		}
	}
	c.vel.x = (c.pos.x - before.x) / dt; c.vel.z = (c.pos.z - before.z) / dt;
	c.gait += Math.hypot(c.vel.x, c.vel.z) * dt / (3.7 * c.size);
	if (b.stand > 0) feet(c, model, dt);

	let idle = 0;
	if (b.state === 'rest') {
		if (t > b.idleAt && b.idleTime < 0) { b.idleTime = 0; b.idleAt = t + c.rnd.range(12, 30); }
		if (b.idleTime >= 0) {
			b.idleTime += dt; const u = clamp(b.idleTime / 1.1, 0, 1);
			idle = Math.sin(Math.PI * u) ** 2 * Math.sin(u * Math.PI * 1.4) * b.idleSign;
			if (u === 1) b.idleTime = -1;
		}
	}
	const slope = b.stand > 0 ? pebbleSlope(sample, c.pos.x, c.pos.z, c.yaw, c.size) : { pitch: b.restPitch, bank: b.restBank };
	if (b.stand > 0) { b.restPitch = slope.pitch; b.restBank = slope.bank; }
	const run = clamp(c.speed / 6, 0, 1);
	b.impact = (b.impact || 0) * Math.exp(-dt * 18);
	const swingIndex = c.feet?.findIndex(f => f.swing >= 0) ?? -1;
	const transfer = swingIndex >= 0 ? Math.sin(c.feet[swingIndex].swing * Math.PI) : 0;
	const supportLean = (swingIndex === 0 ? 1 : -1) * transfer * 0.065;
	const acceleration = (c.speed - previousSpeed) / dt;
	const settle = b.state === 'settle' ? Math.sin(b.timer * 19) * Math.exp(-b.timer * 4) * 0.045 : 0;
	c.pitch = damp(c.pitch, slope.pitch + b.stand * (-0.06 * run - clamp(acceleration * 0.006, -0.12, 0.12)) + idle * 0.02 + settle, 13, dt);
	c.bank = damp(c.bank, slope.bank + supportLean * run + clamp(c.turnRate * c.speed * 0.009, -0.12, 0.12) + idle * 0.035, 12, dt);
	const lift = b.stand * (0.83 + (transfer * 0.06 - b.impact * 0.035) * run) + Math.abs(idle) * 0.035;
	const goalY = c.ground + (PEBBLE_REST_HEIGHT + lift) * c.size;
	// Critically damped suspension gives the body weight while feet keep their
	// contacts. Clamp the underside at rest so settling cannot sink the shell.
	b.yVelocity += ((goalY - c.pos.y) * 190 - b.yVelocity * 27) * dt;
	c.pos.y = Math.max(c.ground + PEBBLE_REST_HEIGHT * c.size, c.pos.y + b.yVelocity * dt);
	if (b.stand === 0 && Math.abs(goalY - c.pos.y) < 0.0001 && Math.abs(b.yVelocity) < 0.002) { c.pos.y = goalY; b.yVelocity = 0; }
	c.vel.y = (c.pos.y - before.y) / dt;
	c.compression = 0; c.hop = 0; c.hopState = b.state;
}

// Fast, short legs need finer contact timing than the world's 30 Hz behavior
// clock. Preserve outer snapshots so rendering still interpolates whole frames.
export function updatePebble(c, model, dt) {
	if (c.group.sample) model = { ...model, environment: { ...model.environment, sample: c.group.sample } };
	const previousStand = c.pebble.stand;
	let previousFeet = c.feet?.map(f => ({ ...f.pos }));
	const steps = Math.max(1, Math.ceil(dt * 120)), step = dt / steps;
	for (let i = 0; i < steps; i++) {
		advancePebble(c, model, step, model.time - dt + (i + 1) * step);
		if (!previousFeet && c.feet) previousFeet = c.feet.map(f => ({ ...f.prev }));
	}
	updatePebbleEyes(c, model, dt);
	c.pebble.prevStand = previousStand;
	if (c.feet && previousFeet) c.feet.forEach((f, j) => { f.prev = previousFeet[j]; });
}
