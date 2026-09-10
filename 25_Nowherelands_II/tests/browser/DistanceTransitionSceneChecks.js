import * as THREE from 'three';

const pixelsDiffer = (a, b) => {
	let pixels = 0, max = 0, sum = 0;
	for (let i = 0; i < a.length; i += 4) {
		let changed = false;
		for (let k = 0; k < 3; k++) { const d = Math.abs(a[i + k] - b[i + k]); max = Math.max(max, d); sum += d * d; changed ||= d > 1; }
		if (changed) pixels++;
	}
	return { pixels, max, rms: Math.sqrt(sum / (a.length / 4 * 3)) };
};

// The real scene at the next chunk boundary, with all other objects and time
// held fixed. Toggle only the outgoing small plants, then read the final pixels
// after bloom. This isolates their removal from ordinary camera motion.
export function measureVegetationDeletion(debug = window.__debug) {
	const d = debug, v = d.terrain.vegetation, camera = d.camera;
	const materials = new Set([v.bladeMaterial, v.shrubMaterial, v.crystalMaterial, v.sproutMaterial, v.lineMaterial, v.riverEcology.material]);
	const selected = [...v.chunks].filter(([k]) => Number(k.split(',')[0]) === -4).flatMap(([, c]) => c.meshes).filter(m => materials.has(m.material));
	const position = camera.position.clone(), rotation = camera.quaternion.clone(), reflect = d.water.far.onBeforeRender;
	const fade = v.fadeUniforms?.uVegetationCamera.value.clone(), visible = selected.map(m => m.visible);
	const time = d.shared.time, hue = d.shared.hue;
	const width = d.renderer.domElement.width, height = d.renderer.domElement.height;
	const gl = d.renderer.getContext(), images = [], reports = [];
	const read = () => { d.post.render(100, d.shared); const data = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data); return data; };
	try {
		d.water.far.onBeforeRender = () => {};
		d.shared.time = 100; d.shared.hue = 0.82;
		v.time = 100;
		for (const u of v.uniformSets) { u.uTime.value = 100; u.uWind.value = 1; u.uPulse.value = 0; }
		v.lineUniforms.uTime.value = 100; v.lineUniforms.uWind.value = 1; v.lineUniforms.uPulse.value = 0; v.lineUniforms.uHue.value = 0.82; v.hueUniform.value = 0.82;
		const target = new THREE.Vector3(-1024, d.heightmap.height(-1024, 0) + 5, 0);
		const ground = Math.max(...Array.from({ length: 25 }, (_, i) => d.heightmap.height(128 - i * 48, 0)));
		for (const elevation of [30, 220]) {
			camera.position.set(128, ground + elevation, 0); camera.lookAt(target); camera.updateMatrixWorld(true);
			v.fadeUniforms?.uVegetationCamera.value.set(128, 0);
			d.shared.terrainUniforms.uCameraPos.value.copy(camera.position); d.shared.terrainUniforms.uTime.value = 100;
			d.water.update(100, camera.position, d.shared); d.inland.update(100, camera.position, d.shared);
			selected.forEach((m, i) => { m.visible = visible[i]; });
			const a = read(), control = read();
			images.push({ elevation, data: d.renderer.domElement.toDataURL() });
			selected.forEach(m => { m.visible = false; }); const b = read();
			reports.push({ elevation, control: pixelsDiffer(a, control), removal: pixelsDiffer(a, b) });
		}
		return { selectedMeshes: selected.length, reports, images };
	} finally {
		selected.forEach((m, i) => { m.visible = visible[i]; }); d.water.far.onBeforeRender = reflect;
		camera.position.copy(position); camera.quaternion.copy(rotation); camera.updateMatrixWorld(true);
		if (fade) v.fadeUniforms.uVegetationCamera.value.copy(fade);
		d.shared.time = time; d.shared.hue = hue;
	}
}

const summary = values => {
	const a = values.slice().sort((a, b) => a - b);
	return { n: a.length, mean: a.reduce((s, v) => s + v, 0) / a.length, p50: a[Math.floor(a.length * 0.5)], p95: a[Math.floor(a.length * 0.95)] };
};

export function checkFadedVegetationCulling(debug = window.__debug) {
	const d = debug, v = d.terrain.vegetation;
	if (!v.fadeUniforms) return { skipped: true };
	const meshes = [...v.chunks.values()].flatMap(c => c.detailMeshes), position = d.camera.position.clone(), rotation = d.camera.quaternion.clone();
	const reflect = d.water.far.onBeforeRender, gl = d.renderer.getContext();
	const width = d.renderer.domElement.width, height = d.renderer.domElement.height;
	const read = () => { d.post.render(100, d.shared); const p = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
	let samples = 0, culledMeshes = 0, maxExtraRms = 0;
	try {
		d.water.far.onBeforeRender = () => {};
		for (const x of [-64, 64]) for (const elevation of [30, 220]) for (let turn = 0; turn < 6; turn++) {
			d.camera.position.set(x, d.heightmap.height(x, 0) + elevation, 0); d.camera.rotation.set(-.12, turn * Math.PI / 3, 0); d.camera.updateMatrixWorld(true);
			v.update(0, v.centerX, v.centerZ); const flags = meshes.map(m => m.visible);
			culledMeshes += flags.filter(x => !x).length;
			const a = read(), control = pixelsDiffer(a, read());
			meshes.forEach(m => { m.visible = true; }); const b = read(), difference = pixelsDiffer(a, b), controlOn = pixelsDiffer(b, read());
			meshes.forEach((m, i) => { m.visible = flags[i]; });
			const controlOff = pixelsDiffer(a, read());
			const controlPixels = Math.max(control.pixels, controlOn.pixels, controlOff.pixels), controlRms = Math.max(control.rms, controlOn.rms, controlOff.rms);
			if (difference.pixels > controlPixels + 2 || difference.rms > controlRms + 0.01) throw new Error(`Distance culling changed visible vegetation at ${x}/${elevation}/${turn}: ${JSON.stringify({ control, controlOn, controlOff, difference })}`);
			maxExtraRms = Math.max(maxExtraRms, difference.rms - controlRms); samples++;
		}
		if (!culledMeshes) throw new Error('Distance culling removed no work');
		return { samples, culledMeshes, maxExtraRms };
	} finally {
		d.camera.position.copy(position); d.camera.quaternion.copy(rotation); d.camera.updateMatrixWorld(true);
		v.update(0, v.centerX, v.centerZ); d.water.far.onBeforeRender = reflect;
	}
}

// Full scene + production postprocessing, fixed populated viewpoints. GPU timer
// queries include reflection captures; results are polled later, never gl.finish.
// World simulation is frozen to isolate the cost of these rendering changes.
export async function measureDistanceRenderCost(debug = window.__debug, frames = 120) {
	const d = debug, gl = d.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
	const reports = [], position = d.camera.position.clone(), rotation = d.camera.quaternion.clone();
	const originalAuto = d.renderer.info.autoReset;
	try {
		d.renderer.info.autoReset = false;
		for (const [name, height, yaw] of [['shore', 30, -Math.PI / 2], ['overlook', 240, -Math.PI / 2], ['inland', 90, Math.PI]]) {
			d.camera.position.set(0, d.heightmap.height(0, 0) + height, 0); d.camera.rotation.set(-0.13, yaw, 0); d.camera.updateMatrixWorld(true);
			d.terrain.vegetation.fadeUniforms?.uVegetationCamera.value.set(0, 0);
			d.shared.terrainUniforms.uCameraPos.value.copy(d.camera.position);
			d.water.update(100, d.camera.position, d.shared); d.inland.update(100, d.camera.position, d.shared);
			const cpu = [], gpu = [], draws = [], triangles = [], pending = [];
			let disjoint = false;
			for (let i = 0; i < frames + 25; i++) {
				await new Promise(resolve => requestAnimationFrame(resolve));
				if (ext && gl.getParameter(ext.GPU_DISJOINT_EXT)) disjoint = true;
				while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
					const query = pending.shift(); gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(query);
				}
				const query = i >= 25 && ext ? gl.createQuery() : null;
				d.renderer.info.reset();
				if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
				const start = performance.now(); d.post.render(100, d.shared); const elapsed = performance.now() - start;
				if (query) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(query); }
				if (i >= 25) { cpu.push(elapsed); draws.push(d.renderer.info.render.calls); triangles.push(d.renderer.info.render.triangles); }
			}
			for (let i = 0; pending.length && i < 120; i++) {
				await new Promise(resolve => requestAnimationFrame(resolve));
				while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
					const query = pending.shift(); gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(query);
				}
			}
			if (ext && gl.getParameter(ext.GPU_DISJOINT_EXT)) disjoint = true;
			const missing = pending.length; pending.forEach(q => gl.deleteQuery(q));
			reports.push({ name, cpu: summary(cpu), gpu: gpu.length && !disjoint ? summary(gpu) : null, draws: summary(draws), triangles: summary(triangles), disjoint, missing, gpuTimerAvailable: !!ext });
		}
		return reports;
	} finally {
		d.renderer.info.autoReset = originalAuto; d.camera.position.copy(position); d.camera.quaternion.copy(rotation); d.camera.updateMatrixWorld(true);
	}
}
