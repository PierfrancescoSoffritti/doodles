import { rayHabitatSite } from './VeilRayHabitat.js';
import { watchPebbleVolume } from '../../audio/PebbleAudioSettings.js?v=pebble-audio-10';
import { LumenLight } from './LumenLight.js';
import { FaunaProfile } from './FaunaProfile.js';
import { Random } from '../../core/Random.js';
import { bus, Events } from '../../core/EventBus.js';
import { FaunaModel, SPECIES } from './FaunaModel.js?v=pebble-voice-4b';
import { FaunaMeshes } from './FaunaMeshes.js?v=pebble-voice-4b';
import { FaunaAudio } from '../../audio/FaunaAudio.js?v=pebble-audio-10';
import { pebbleHabitatSites } from './PebbleHabitats.js?v=pebble-audio-10';
import { PebbleColonyTour } from './PebbleColonyTour.js?v=2';
import { lumenLakes } from './LumenSchool.js?v=player-notes-13';

const CELL = 220, STEP = 1 / 30;

export class Fauna {
	constructor(scene, heightmap, shared) {
		this.shared = shared; this.hm = heightmap; this.accumulator = 0; this.streamTimer = 0; this.cells = new Set(); this.queue = [];
		this.offVolume=watchPebbleVolume(volume=>{this.pebbleVolume=volume;if(this.audio)this.audio.pebbles.volume=volume;});
		this.sample = (x, z) => {
			const ground = heightmap.sample(x, z), water = heightmap._water, lake = heightmap.lakes?.shoreId, slope = heightmap._slope || 0, foam = heightmap._foam || 0, hardness = heightmap._hardness, roof = heightmap.caves?.surfaceDensity(x, ground, z) > -2;
			const hab = heightmap.habitat(x, z);
			return { ground, water, lake, slope, foam, hardness, roof, forest: hab.forest, wet: hab.wet, coast: hab.coast };
		};
		this.obstacles = [];
		this.lakes = lumenLakes(shared.world, this.sample);
		this.pebbleSites = pebbleHabitatSites(shared.world, this.lakes, heightmap, this.sample);
		this.pebbleSiteRetries = new Map(); this.pebbleTour = new PebbleColonyTour(this.pebbleSites);
		this.model = new FaunaModel(shared.world.seed || shared.seed || 'nowhere', { sample: this.sample, lakes: this.lakes, raySites: true, avoid: p => this.avoid(p), blocked: (x, z, radius, ground) => this.obstacles.some(o => Math.hypot(x - o.position.x, z - o.position.z) < o.radius + radius && Math.abs(ground - o.position.y) < Math.max(12, o.radius * 2)) });
		this.raySites = new Map(); this.rayVisited = new Set();
		this.meshes = new FaunaMeshes(scene, shared);
		this.light = new LumenLight(shared);
		this.model.onPebbleSound = (c,event) => {
   const surface=(c.group.sample || this.sample)(c.pos.x,c.pos.z);
   this.audio?.pebble(c,event,{cave:!!surface.cave,listener:shared.player.position});
  };
		this.model.onNoteReply = (kind,c,alarm) => shared.playerNotes?.reply(kind,c,alarm);
		this.model.onRaySilence = () => this.audio?.silenceRays();
		this.model.onCall = (c, landing, phrase = 'contact') => {
   if(c.kind==='hopper') {if(!landing)this.model.onPebbleSound(c,'startle');return;}
			if ((shared.caveAmount || 0) > 0.4 || document.hidden) return false;
			const accepted = this.audio?.call(c, landing, false, phrase);
			// A physical landing makes a small water ripple only at an actual waterline.
			if (landing && Math.abs(c.water - c.ground) < 0.5) bus.emit(Events.RIPPLE, { x: c.pos.x, z: c.pos.z, size: 0.12, hue: shared.hue });
			return accepted;
		};
		this.model.onEscape = c => { if ((shared.caveAmount || 0) < 0.4) this.audio?.escape(c); };
		if (new URLSearchParams(globalThis.location?.search || '').has('faunaProfile')) this.profile = new FaunaProfile(this);
		this.off = [bus.on(Events.NOTE, note => {if(note.layer!=='player-note')this.model.hear({ ...note, strength: note.velocity });}),
			bus.on('footstep', () => this.model.hear({ position: shared.player.position, strength: 0.38, freq: 180, layer: 'footstep' }))];
	}
	prime(position, seed) {
		this.model.seed = seed; this.model.listener = position;
		this.refreshObstacles(position);
		this.streamPebbleSites(position);
		// Seed a diverse first encounter using real habitat searches around the spawn.
		this.streamRays(position);
		for (const kind of Object.keys(SPECIES).filter(k => k !== 'ray')) {
			if (kind === 'lumen' && this.lakes.length) {
				const lakes = [...this.lakes].sort((a, b) => Math.hypot(a.x - position.x, a.z - position.z) - Math.hypot(b.x - position.x, b.z - position.z));
				const lake = lakes[0];
				this.model.addGroup('lumen-flock', 'lumen', lake.x, lake.z, 6);
				continue;
			}
			const group = this.model.addGroup(`arrival:${kind}`, kind, position.x, position.z, 140);
			if (!group) this.model.addGroup(`arrival:${kind}`, kind, position.x, position.z, 360);
		}
	}
	avoid(p) {
		let x = 0, z = 0;
		for (const o of this.obstacles) {
			const dx = p.x - o.position.x, dz = p.z - o.position.z, d = Math.hypot(dx, dz), r = o.radius + 7;
			if (d < r && Math.abs(p.y - o.position.y) < Math.max(30, o.radius * 12)) {
				x += dx / Math.max(d, 0.1) * (1 - d / r) * 6; z += dz / Math.max(d, 0.1) * (1 - d / r) * 6;
			}
		}
		return { x, z };
	}
	refreshObstacles(position) {
		this.obstacles = this.shared.colliders.filter(o => Math.hypot(o.position.x - position.x, o.position.z - position.z) < 280).slice(0, 120);
	}
	stream(position) {
		this.refreshObstacles(position);
		this.pebbleTour.remember(this.model.groups.values());
		this.model.removeFar(position);
		this.streamPebbleSites(position);
		this.streamRays(position);
		if ((this.shared.caveAmount || 0) > 0.4) return;
		const cx = Math.floor(position.x / CELL), cz = Math.floor(position.z / CELL);
		for (const key of this.cells) {
			const [x, z] = key.split(',').map(Number); if (Math.abs(x - cx) > 4 || Math.abs(z - cz) > 4) this.cells.delete(key);
		}
		const wanted = [];
		for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) {
			const key = `${x},${z}`; if (!this.cells.has(key)) wanted.push({ x, z, key, distance: Math.hypot(x - cx, z - cz) });
		}
		wanted.sort((a, b) => a.distance - b.distance);
		const next = wanted[0];
		if (next) {
			this.cells.add(next.key); const rnd = new Random(`${this.model.seed}:fauna-cell:${next.key}`), kinds = Object.keys(SPECIES).filter(k => k !== 'ray');
			for (let i = 0; i < 2; i++) {
				const kind = rnd.pick(kinds); if (kind === 'lumen' && this.lakes.length) continue;
				const group = this.model.addGroup(`${next.key}:${kind}`, kind, (next.x + 0.5) * CELL, (next.z + 0.5) * CELL, 100);
				if (group) for (const c of group.members) c.born = this.model.time;
			}
		}
	}
	update(dt) {
		const { shared, model } = this;
		this.profile?.begin();
		if (shared.audio && !this.audio) {this.audio = new FaunaAudio(shared.audio, shared.conductor);this.audio.pebbles.volume=this.pebbleVolume;}
		model.listener = shared.player.position;
		model.playerSpeed = shared.player.speed; model.playerVelocity = shared.player.velocity;
		model.raysHidden = shared.surfaceStreaming === false || (shared.caveAmount || 0) > 0.4 || document.hidden;
		model.rayWeather = { storm: shared.state.storm || 0, rain: shared.state.rainVisible || 0, wind: shared.weather?.local.windSpeed || 0, bright: shared.sun.height > 0.12 && shared.sun.intensity > 0.65 };
		if(model.raysHidden && !this.raysWereHidden)this.audio?.silenceRays();
		this.raysWereHidden=model.raysHidden;
		model.activity = shared.audio ? shared.audio.analysis.level : 0;
		this.streamTimer -= dt;
		if (this.streamTimer <= 0) { this.stream(model.listener); this.streamTimer = 0.5; }
		this.accumulator = Math.min(this.accumulator + dt, STEP * 3);
		while (this.accumulator >= STEP) { model.step(STEP); this.accumulator -= STEP; }
		this.meshes.update(model, this.accumulator / STEP, dt, this.sample);
		this.light.update(model,dt);
		this.audio?.update();
		this.profile?.end();
	}
	addPebbleSite(site, position) {
		const id = `pebble-site:${site.id}`;
		if (this.model.groups.has(id)) return this.model.groups.get(id);
		if (!this.model.reservePebbleSpace(position)) return null;
		const group = this.model.addGroup(id, 'hopper', site.x, site.z, site.radius, { sample: site.sample, habitat: site.habitat });
		if (group) for (const c of group.members) c.born = this.model.time;
		return group;
	}
	streamPebbleSites(position) {
		const distance = s => Math.hypot(s.x - position.x, s.z - position.z, (s.y - position.y) * 0.5);
		const sites = this.pebbleSites.filter(s => distance(s) < 530 && !this.model.groups.has(`pebble-site:${s.id}`) && (this.pebbleSiteRetries.get(s.id) || 0) <= this.model.time).sort((a, b) => distance(a) - distance(b));
		for (const site of sites.slice(0, 2)) {
			this.pebbleSiteRetries.set(site.id, this.model.time + 15);
			if (this.addPebbleSite(site, position)) break;
		}
	}

	findPebbleColony(current) {
		this.pebbleTour.remember(this.model.groups.values());
		const load = site => {
			const existing = this.model.groups.get(site.id);
			if (existing?.members.length) return existing;
			// A tour teleport may target an unloaded region. Reserve room for a
			// complete colony before spawning it, keeping the current stop on failure.
			const others = [...this.model.groups.values()].filter(g => g.kind === 'hopper' && g !== current)
				.sort((a, b) => Math.hypot(b.home.x - site.x, b.home.z - site.z) - Math.hypot(a.home.x - site.x, a.home.z - site.z));
			let count = this.model.creatures.filter(c => c.kind === 'hopper').length;
			for (const g of others) {
				if (count <= SPECIES.hopper.cap - 6) break;
				this.model.groups.delete(g.id); this.model.creatures = this.model.creatures.filter(c => c.group !== g); count -= g.members.length;
			}
			const group = this.model.addGroup(site.id, 'hopper', site.x, site.z, site.radius, { sample: site.sample, habitat: site.habitat });
			if (group) for (const c of group.members) c.born = this.model.time - 2;
			return group;
		};
		const next = this.pebbleTour.next(current, load);
		if (next) return next;
		// Worlds without suitable authored sites can still discover gravel patches.
		const p = current?.home || this.shared.player.position;
		const visit = this.pebbleSearch = (this.pebbleSearch || 0) + 1;
		const rnd = new Random(`${this.model.seed}:pebble-tour:${visit}`);
		for (let i = 0; i < 12; i++) {
			const angle = rnd.range(0, Math.PI * 2), radius = 420 + i * 65;
			const group = load({ id: `pebble-tour:${visit}:${i}`, x: p.x + Math.cos(angle) * radius, z: p.z + Math.sin(angle) * radius, radius: 170 });
			if (group) { this.pebbleTour.remember([group]); this.pebbleTour.visited.add(group.id); this.pebbleTour.stops++; return group; }
		}
		return null;
	}

 raySite(lake) {
  if (!this.raySites.has(lake.id)) this.raySites.set(lake.id, rayHabitatSite(lake,this.model.seed,this.sample));
  return this.raySites.get(lake.id);
 }
 addRaySite(site) {
  if (!site) return null;
  // Streamed obstacles may reject a home, but never change its seeded identity.
  if(this.model.environment.blocked(site.x,site.z,site.radius,site.y+10))return null;
  return this.model.addGroup(site.id,'ray',site.x,site.z,1,{raySite:site});
 }
 streamRays(position) {
  if ((this.shared.caveAmount || 0)>0.4) return;
  const lakes=this.lakes.filter(l=>l.shore.some(q=>Math.hypot(q.x-position.x,q.z-position.z)<500))
   .sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z));
  let attempts=0;
  for (const lake of lakes) {
   if(this.model.creatures.filter(c=>c.kind==='ray').length>=SPECIES.ray.cap)break;
   if(!this.raySites.has(lake.id)&&attempts++>=1)break;
   this.addRaySite(this.raySite(lake));
  }
 }
 findRay(current = null) {
  const p=this.shared.player.position;
  const lakes=[...this.lakes].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  if(current)this.rayVisited.add(current.id);
  if(lakes.every(l=>this.rayVisited.has(`ray-lake:${l.id}`)||this.raySites.get(l.id)===null))this.rayVisited.clear();
  for(let i=0;i<lakes.length;i++) {
   const lake=lakes[i];if(this.rayVisited.has(`ray-lake:${lake.id}`))continue;
   const site=this.raySite(lake);if(!site||site.id===current?.id)continue;
   // A guided visit loads a real habitat, freeing distant ray slots if needed.
   const existing=this.model.groups.get(site.id);if(existing){this.rayVisited.add(site.id);return existing;}
   for(const g of [...this.model.groups.values()])if(g.raySite && Math.hypot(g.home.x-site.x,g.home.z-site.z)>200) {
    this.model.groups.delete(g.id);this.model.creatures=this.model.creatures.filter(c=>c.group!==g);
   }
   const group=this.addRaySite(site);if(group){this.rayVisited.add(site.id);return group;}
  }
  return current;
 }
 playerRayNote(charge=0) { return this.shared.playerNotes?.send(charge) || false; }

	nearest(kind) {
		const p = this.shared.player.position;
		return this.model.creatures.filter(c => c.kind === kind).sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z))[0];
	}
	dispose() { this.offVolume(); this.light.dispose(); this.off.forEach(fn => fn()); this.audio?.dispose(); this.meshes.root.removeFromParent(); this.meshes.root.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }
}
