// Opt-in movement benchmark (?rivers=1&profile=1). Wall-clock motion makes before/after
// runs cover the same distance even when a frame stalls. Timings measure CPU work;
// frame intervals also capture GPU/presentation delays.
export class MovementProfile {
	constructor(shared, survey, modules) {
		this.shared = shared; this.survey = survey; this.frames = []; this.running = false; this.costs = {};
		this.output = document.createElement('output'); this.output.className = 'movement-profile';
		this.button = document.createElement('button'); this.button.textContent = 'Test movement (24s)'; this.button.onclick = () => this.start();
		survey.panel.append(this.button, this.output);
		const watch = (obj, method, label) => {
			const original = obj[method]; obj[method] = (...args) => { const t = performance.now(); try { return original.apply(obj, args); } finally { this.costs[label] = (this.costs[label] || 0) + performance.now() - t; } };
		};
		for (const [object, method, name] of [
			[modules.terrain, 'build', 'terrainBuild'], [modules.terrain.vegetation, 'addChunk', 'vegetationBuild'],
			[modules.terrain.vegetation, 'addFarChunk', 'farTrees'], [modules.terrain.vegetation, 'update', 'vegetationUpdate'],
			[modules.inland, 'rebuildNear', 'waterBuild'], [modules.inland, 'installNear', 'waterInstall'], [modules.shoreMap, 'update', 'shoreMap'],
			[modules.pmrem, 'fromScene', 'environment'], [modules.watersideLife, 'update', 'life'], [modules.post, 'render', 'render']
		]) watch(object, method, name);
	}
	start() {
		this.startTime = performance.now() + 4000; this.frames = []; this.pendingFrame = null; this.running = true; this.button.disabled = true;
		const p = this.shared.player; this.origin = p.position.clone(); this.yaw = p.yaw;
		this.output.textContent = 'Warming the view…'; this.survey.panel.dataset.profile = '';
	}
	begin(now, interval) {
		// This interval follows the work recorded at the end of the previous frame.
		if (this.pendingFrame) { this.frames.push({ ms: interval, ...this.pendingFrame }); this.pendingFrame = null; }
		this.costs = {}; this.frameStart = performance.now();
		if (!this.running) return;
		const elapsed = (now - this.startTime) / 1000;
		if (elapsed < 0) return;
		if (elapsed > 20) { this.finish(); return; }
		const p = this.shared.player, distance = elapsed * 60;
		const x = this.origin.x - Math.sin(this.yaw) * distance, z = this.origin.z - Math.cos(this.yaw) * distance;
		const y = Math.max(this.shared.heightmap.height(x, z) + 18, this.shared.heightmap.waterAt(x, z) + 18);
		p.position.set(x, y, z); p.velocity.set(0, 0, 0); p.fly = true; p.yaw = this.yaw; p.pitch = -0.18;
		this.output.textContent = `Moving · ${Math.floor(elapsed)} / 20 s`;
	}
	end() {
		if (!this.running || performance.now() < this.startTime) return;
		this.pendingFrame = { cpu: performance.now() - this.frameStart, ...this.costs };
	}
	finish() {
		this.running = false; this.button.disabled = false;
		const frames = this.frames, values = frames.map(f => f.ms).sort((a,b) => a-b);
		const pick = q => values[Math.min(values.length - 1, Math.floor(values.length * q))] || 0;
		const phases = {};
		for (const f of frames) for (const [k,v] of Object.entries(f)) if (k !== 'ms' && k !== 'cpu') { const p = phases[k] || (phases[k] = { max: 0, total: 0, over8: 0 }); p.max = Math.max(p.max,v); p.total += v; if (v > 8) p.over8++; }
		const canvas = this.shared.renderer.domElement;
		const result = { seed: new URLSearchParams(location.search).get('seed'), resolution: `${canvas.width}x${canvas.height}`, origin: this.origin.toArray(), yaw: this.yaw, speed: 60, seconds: 20, frames: frames.length, p50: pick(.5), p95: pick(.95), p99: pick(.99), max: pick(1), over33: values.filter(v=>v>33.4).length, over50: values.filter(v=>v>50).length, phases, worst: frames.slice().sort((a,b)=>b.cpu-a.cpu).slice(0,8) };
		this.survey.panel.dataset.profile = JSON.stringify(result);
		this.output.textContent = `Movement · p95 ${result.p95.toFixed(1)} ms · p99 ${result.p99.toFixed(1)} ms · ${result.over50} frames over 50 ms`;
	}
}
