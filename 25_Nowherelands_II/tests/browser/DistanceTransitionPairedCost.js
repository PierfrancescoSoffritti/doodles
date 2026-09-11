import * as THREE from 'three';

// Run only in a paused, disposable audit page. The runner serves ?distance-baseline=1
// from the saved pre-change modules. Both variants render the SAME frozen world,
// geometry, fauna, viewport and camera; only the changed materials are swapped.
export async function measurePairedCost(debug = window.__debug) {
	const [{ Vegetation }, { createTerrainMaterial }, sea] = await Promise.all([
		import('../../js/world/Vegetation.js?v=player-notes-13'),
		import('../../js/world/TerrainMaterial.js?v=player-notes-13'),
		import('../../js/world/SeaShader.js?v=player-notes-13'),
	]);
	const d = debug, v = d.terrain.vegetation, gl = d.renderer.getContext();
	const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
	if (!ext) throw new Error('GPU timing is unavailable');
	const oldTerrain = createTerrainMaterial(d.shared, d.heightmap);
	oldTerrain.uniforms = d.terrain.material.uniforms;
	const oldVegetation = new Vegetation(new THREE.Scene(), d.heightmap, d.shared);
	oldVegetation.uniformSets.forEach((u, i) => Object.assign(u, v.uniformSets[i]));
	Object.assign(oldVegetation.lineUniforms, v.lineUniforms); oldVegetation.hueUniform = v.hueUniform;
	const materials = new Map([[d.terrain.material, oldTerrain]]);
	for (const key of ['bladeMaterial', 'shrubMaterial', 'sproutMaterial', 'crystalMaterial', 'lineMaterial']) materials.set(v[key], oldVegetation[key]);
	materials.set(v.riverEcology.material, oldVegetation.riverEcology.material);
	for (const m of [d.water.material, d.water.far.material]) {
		const old = m.clone(); old.uniforms = m.uniforms; old.vertexShader = sea.seaVertexShader(d.shared); old.fragmentShader = sea.seaFragmentShader(d.shared); materials.set(m, old);
	}
	const objects = []; d.scene.traverse(o => { if (materials.has(o.material)) objects.push([o, o.material, o.visible]); });
	const setVariant = variant => objects.forEach(([o, material, visible]) => {
		o.material = variant === 'before' ? materials.get(material) : material;
		if (material.userData.distanceFaded) o.visible = variant === 'before' ? true : visible;
	});
	const originalReflection = d.water.far.onBeforeRender, originalAuto = d.renderer.info.autoReset;
	const realNow = performance.now.bind(performance);
	let reflectionTime = realNow(), capture = false;
	// Fix capture cadence at one per four rendered frames (15 Hz at 60 fps), so
	// timing jitter cannot give one variant more expensive reflection frames.
	d.water.far.onBeforeRender = function (...args) {
		if (capture) reflectionTime += 100;
		const now = performance.now; performance.now = () => reflectionTime;
		try { return originalReflection.apply(this, args); } finally { performance.now = now; }
	};
	const reports = [], stats = a => {
		const s = a.slice().sort((x, y) => x - y);
		return { n: s.length, mean: s.reduce((a, x) => a + x, 0) / s.length, p50: s[Math.floor(s.length * .5)], p95: s[Math.floor(s.length * .95)] };
	};
	try {
		d.renderer.info.autoReset = false;
		for (const [name, height, yaw] of [['shore', 30, -Math.PI / 2], ['overlook', 240, -Math.PI / 2], ['inland', 90, Math.PI]]) {
			d.camera.position.set(0, d.heightmap.height(0, 0) + height, 0); d.camera.rotation.set(-.13, yaw, 0); d.camera.updateMatrixWorld(true);
			v.fadeUniforms.uVegetationCamera.value.set(0, 0); d.shared.terrainUniforms.uCameraPos.value.copy(d.camera.position);
			d.water.update(100, d.camera.position, d.shared); d.inland.update(100, d.camera.position, d.shared);
			for (const variant of ['before', 'after']) {
				setVariant(variant);
				for (let i = 0; i < 25; i++) { await new Promise(r => requestAnimationFrame(r)); capture = i % 4 === 0; d.post.render(100, d.shared); }
			}
			const data = Object.fromEntries(['before', 'after'].map(k => [k, { cpu: [], gpu: [], draws: [], triangles: [] }]));
			let disjoint = false;
			for (const variant of ['before', 'after', 'after', 'before']) {
				setVariant(variant); const pending = [];
				for (let i = 0; i < 60; i++) {
					await new Promise(r => requestAnimationFrame(r)); capture = i % 4 === 0;
					disjoint ||= gl.getParameter(ext.GPU_DISJOINT_EXT);
					while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
						const q = pending.shift(); data[variant].gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q);
					}
					const q = gl.createQuery(); d.renderer.info.reset(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
					const start = realNow(); d.post.render(100, d.shared); data[variant].cpu.push(realNow() - start);
					gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q);
					data[variant].draws.push(d.renderer.info.render.calls); data[variant].triangles.push(d.renderer.info.render.triangles);
				}
				for (let i = 0; pending.length && i < 120; i++) {
					await new Promise(r => requestAnimationFrame(r));
					while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
						const q = pending.shift(); data[variant].gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q);
					}
				}
				if (pending.length) throw new Error('GPU query did not complete');
			}
			if (disjoint || gl.getParameter(ext.GPU_DISJOINT_EXT)) throw new Error('GPU timer became disjoint');
			const report = { name };
			for (const variant of ['before', 'after']) report[variant] = Object.fromEntries(Object.entries(data[variant]).map(([key, values]) => [key, stats(values)]));
			report.gpuMeanChangePercent = (report.after.gpu.mean / report.before.gpu.mean - 1) * 100;
			if (report.after.draws.mean > report.before.draws.mean || report.after.triangles.mean > report.before.triangles.mean) throw new Error('Faded vegetation culling increased draw work');
			reports.push(report);
		}
		return reports;
	} finally {
		setVariant('after'); d.water.far.onBeforeRender = originalReflection; d.renderer.info.autoReset = originalAuto;
	}
}
