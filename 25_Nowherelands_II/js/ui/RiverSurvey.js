import { RIVER_STRIDE as S, RV, surfaceHalfWidth } from '../world/gen/Rivers.js';

// Optional inspection tour (?rivers=1). Uses the actual generated reaches, with measured
// frame times and hydraulic data so the same seed can be checked repeatedly.
export class RiverSurvey {
	constructor(shared, terrain) {
		this.shared = shared; this.terrain = terrain; this.samples = []; this.elapsed = 0;
		this.panel = document.createElement('aside');
		this.panel.className = 'river-survey';
		const title = document.createElement('div'); title.textContent = 'FOLLOW THE WATER'; this.panel.append(title);
		this.readout = document.createElement('output');
		const sites = [
			['Mountain torrent', (d, o) => d[o + RV.WL] > 160 && d[o + RV.WL] < 850 ? d[o + RV.FOAM] * d[o + RV.SPEED] * Math.sqrt(d[o + RV.W]) : 0],
			['Gravel reach', (d, o) => d[o + RV.WL] > 25 && d[o + RV.WL] < 180 && d[o + RV.D] < 5 ? Math.abs(d[o + RV.BEND]) * d[o + RV.W] * (1 - d[o + RV.FOAM]) : 0],
			['Lowland bends', (d, o) => d[o + RV.WL] > 2 && d[o + RV.WL] < 35 && d[o + RV.FOAM] < 0.08 && d[o + RV.SPEED] < 5.5 && d[o + RV.W] > 16 ? Math.abs(d[o + RV.BEND]) * d[o + RV.W] : 0],
			['Lake outlet', (d, o, r, i) => r.fromLake >= 0 && i < 9 ? 1000 + d[o + RV.WL] - i * 100 : 0],
			['Divided channel', (d, o) => d[o + RV.BAR] > 0.9 ? d[o + RV.BAR] * d[o + RV.W] : 0],
			['Deep pool', (d, o) => d[o + RV.WL] > 20 && d[o + RV.WL] < 350 && d[o + RV.FOAM] < 0.1 ? d[o + RV.D] * Math.min(d[o + RV.W], 35) : 0],
		];
		for (const [label, score] of sites) {
			let best = null, max = 0;
			for (const r of shared.world.rivers) for (let i = 3; i < r.count - 3; i++) {
				const o = i * S;
				if (r.data[o + RV.KIND] !== 0) continue;
				const v = score(r.data, o, r, i);
				if (v > max) { max = v; best = { r, i, label }; }
			}
			const button = document.createElement('button'); button.textContent = label; button.disabled = !best;
			button.onclick = () => this.visit(best); this.panel.append(button);
			if (!this.first && best) this.first = best;
		}
		const features = shared.waterside.items.filter(f => f.type === 'fallen');
		features.sort((a, b) => (a.a[1] + a.b[1]) - (b.a[1] + b.b[1]));
		const log = features.find(f => f.a[1] > 12) || features[0];
		const lakeSpots = Array.from(shared.waterside.shoreCells.values()).flat().filter(s => s.fetch < 0.5 && s.level < 350);
		lakeSpots.sort((a, b) => (a.fetch + a.slope * 2 + a.hard) - (b.fetch + b.slope * 2 + b.hard));
		for (const site of [log ? { label: 'Fallen tree', feature: log } : null, lakeSpots[0] ? { label: 'Sheltered lake', shore: lakeSpots[0] } : null]) {
			if (!site) continue;
			const button = document.createElement('button'); button.textContent = site.label; button.onclick = () => this.visit(site); this.panel.append(button);
		}

		const closer = document.createElement('button'); closer.textContent = 'At water level';
		closer.onclick = () => this.visit(this.site, true); this.panel.append(closer);
		const explore = document.createElement('button'); explore.textContent = 'Explore here';
		explore.onclick = () => { shared.player.fly = false; shared.hud.enterBtn.click(); this.panel.hidden = true; };
		this.panel.append(explore, this.readout); document.body.append(this.panel);
		shared.hud.intro.classList.add('hidden'); shared.hud.el.classList.add('visible');
		this.visit(this.first);
	}
	visit(site, close = false) {
		if (!site) return;
		this.site = site; this.samples = []; this.elapsed = -3;
		const { shared } = this;
		if (site.feature || site.shore) {
			const hm = shared.heightmap; let x, y, z, px, pz;
			if (site.feature) {
				const f = site.feature, river = shared.world.rivers.find(r => r.id === f.river), o = f.sample * S;
				x = (f.a[0] + f.b[0]) / 2; y = (f.a[1] + f.b[1]) / 2; z = (f.a[2] + f.b[2]) / 2;
				const dx = river.data[o + S] - river.data[o], dz = river.data[o + S + 1] - river.data[o + 1], l = Math.hypot(dx, dz) || 1;
				px = x + dx / l * (close ? 12 : 34); pz = z + dz / l * (close ? 12 : 34);
			} else {
				const shore = site.shore; x = shore.x; y = shore.level; z = shore.z;
				const gx = hm.height(x + 4, z) - hm.height(x - 4, z), gz = hm.height(x, z + 4) - hm.height(x, z - 4), l = Math.hypot(gx, gz) || 1;
				px = x + gx / l * 16; pz = z + gz / l * 16; x -= gx / l * 25; z -= gz / l * 25;
			}
			const py = Math.max(hm.height(px, pz) + (close ? 5 : 12), y + (close ? 4 : 15));
			shared.player.position.set(px, py, pz); shared.player.velocity.set(0, 0, 0);
			shared.player.yaw = Math.atan2(px - x, pz - z); shared.player.pitch = Math.atan2(y - py, Math.hypot(x - px, z - pz)); shared.player.fly = true;
			this.readout.textContent = site.label + ' · settling…'; return;
		}
		const { r } = site, i = site.label === 'Lake outlet' ? 0 : site.i, d = r.data, o = i * S;
		const x = d[o], z = d[o + 1], wl = d[o + RV.WL], w = d[o + RV.W];
		const j = Math.min(r.count - 1, i + 3) * S;
		const len = Math.hypot(d[j] - x, d[j + 1] - z) || 1, tx = (d[j] - x) / len, tz = (d[j + 1] - z) / len;
		const side = Math.sign(d[o + RV.BEND]) || 1;
		const offset = close ? w * 0.22 : surfaceHalfWidth(w, d[o + RV.D], d[o + RV.BANK], side, d[o + RV.BEND]) + 12;
		const px = x - tz * offset * side + tx * w * 0.65, pz = z + tx * offset * side + tz * w * 0.65;
		const py = close ? wl + 3.5 : Math.max(shared.heightmap.height(px, pz) + 16, wl + w * 0.38);
		const look = Math.max(0, i - Math.round(Math.max(w * 1.8, 40) / 8)) * S;
		const dx = d[look] - px, dz = d[look + 1] - pz, dy = d[look + RV.WL] - py;
		shared.player.position.set(px, py, pz); shared.player.velocity.set(0, 0, 0);
		shared.player.yaw = Math.atan2(-dx, -dz); shared.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
		shared.player.fly = true;
		shared.state.snow = shared.state.rain = shared.state.snowVisible = shared.state.rainVisible = 0;
		this.readout.textContent = site.label + ' · settling…';
	}
	update(ms) {
		this.panel.dataset.audio = this.shared.audio?.ctx.state || 'off';
		this.panel.dataset.ambience = JSON.stringify(this.shared.watersideAmbience?.voices.map(v => v.amount) || []);
		if (this.panel.hidden) return;
		this.shared.state.snow = this.shared.state.rain = this.shared.state.snowVisible = this.shared.state.rainVisible = 0;
		this.elapsed += ms / 1000;
		if (this.elapsed < 0 || !this.site) return;
		this.samples.push(ms);
		if (this.samples.length < 120) return;
		const sorted = this.samples.slice().sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)], p95 = sorted[Math.floor(sorted.length * 0.95)];
		const { r, i, label } = this.site, d = r?.data, o = i * S;
		const counts = {};
		for (const chunk of this.terrain.vegetation.chunks.values()) for (const mesh of chunk.meshes) if (mesh.name.startsWith('river-')) counts[mesh.name] = (counts[mesh.name] || 0) + mesh.count;
		this.panel.dataset.ecology = JSON.stringify(counts);
		this.panel.dataset.features = JSON.stringify(this.shared.waterside.items.reduce((out, f) => { out[f.type] = (out[f.type] || 0) + 1; return out; }, {}));
		this.panel.dataset.life = JSON.stringify(this.shared.scene.getObjectByName('waterside-life')?.userData.population || {});
		this.panel.dataset.triangles = this.shared.renderer.info.render.triangles;
		this.panel.dataset.resolution = `${this.shared.renderer.domElement.width}x${this.shared.renderer.domElement.height}`;
		const detail = d ? ` · ${d[o + RV.W].toFixed(1)} m wide · ${d[o + RV.D].toFixed(1)} m deep · ${d[o + RV.SPEED].toFixed(1)} m/s` : '';
		this.readout.textContent = `${label}${detail}\n${(1000 / median).toFixed(0)} fps median · ${p95.toFixed(1)} ms p95`;
		this.samples = [];
	}
}
