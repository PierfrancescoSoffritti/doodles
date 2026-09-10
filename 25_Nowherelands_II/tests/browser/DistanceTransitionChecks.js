import * as THREE from 'three';
import { seaVertexShader, buildWaves } from '../../js/world/SeaShader.js';

const assert = (ok, message) => { if (!ok) throw new Error(message); };

// Execute the production ocean vertex shader with a controlled deep/shore/mouth
// sample. Transform feedback reads its displaced positions, not a JS copy of the fade.
export function measureOceanEdge(debug = window.__debug) {
	const gl = document.createElement('canvas').getContext('webgl2');
	const shader = seaVertexShader({ shoreMap: { glsl: 'uniform vec4 auditShore; vec4 shoreSample(vec2 p) { return auditShore; }' } });
	const program = gl.createProgram(), shaders = [];
	for (const [type, source] of [
		[gl.VERTEX_SHADER, '#version 300 es\nprecision highp float;\n#define varying out\nin vec3 position; uniform mat4 modelMatrix, viewMatrix, projectionMatrix;\n' + shader],
		[gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1.0);}'],
	]) {
		const s = gl.createShader(type); shaders.push(s); gl.shaderSource(s, source); gl.compileShader(s);
		assert(gl.getShaderParameter(s, gl.COMPILE_STATUS), gl.getShaderInfoLog(s)); gl.attachShader(program, s);
	}
	gl.transformFeedbackVaryings(program, ['vWorldPos'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(program);
	assert(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program)); gl.useProgram(program);
	const source = debug.water.levels.at(-1).geometry.attributes.position;
	const extent = Math.max(...source.array.filter((_, i) => i % 3 === 0));
	const points = [];
	for (let i = 0; i < source.count; i++) if (Math.max(Math.abs(source.getX(i)), Math.abs(source.getZ(i))) === extent)
		points.push(source.getX(i), 0, source.getZ(i));
	const boundaryCount = points.length / 3;
	// A control in the unchanged inner sea must still move.
	points.push(32, 0, 48, 512, 0, -128, 2048, 0, 256);
	const positions = new Float32Array(points), output = new Float32Array(points.length);
	const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
	const input = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, input); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	const loc = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
	const feedback = gl.createTransformFeedback(), buffer = gl.createBuffer(); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
	gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, positions.byteLength, gl.DYNAMIC_READ);
	const identity = new THREE.Matrix4();
	const set = (name, value) => {
		const u = gl.getUniformLocation(program, name); if (u === null) return;
		if (typeof value === 'number') gl.uniform1f(u, value);
		else if (value.isMatrix4) gl.uniformMatrix4fv(u, false, value.elements);
		else if (value.isVector2) gl.uniform2fv(u, value.toArray());
		else if (value.isVector3) gl.uniform3fv(u, value.toArray());
		else if (Array.isArray(value) && value[0]?.isVector4) gl.uniform4fv(u, value.flatMap(v => v.toArray()));
		else if (Array.isArray(value) && value[0]?.isVector2) gl.uniform2fv(u, value.flatMap(v => v.toArray()));
	};
	for (const [key, u] of Object.entries(debug.water.uniforms)) set(key, u.value);
	const waves = buildWaves(0.61); set('uWaves[0]', waves.waves); set('uWaves2[0]', waves.waves2);
	for (const name of ['modelMatrix', 'viewMatrix', 'projectionMatrix']) set(name, identity);
	let maxGap = 0, nearMotion = 0, samples = 0;
	const controls = [];
	try {
		for (const [cx, cz] of [[0, 0], [64, -64], [-640, 1216]]) for (const shore of [[-1000, 0, 1000, 0], [-4, 0, 12, 0], [-4, 0, 12, 0.5]])
		for (const swell of [1, 2.7]) for (const time of [0, 1.7, 8.4, 31]) {
			set('modelMatrix', new THREE.Matrix4().makeTranslation(cx, 0, cz));
			set('uCameraPos', new THREE.Vector3(cx + 31, 11, cz - 31));
			set('uTime', time); set('uSwell', swell); set('uSurfEnergy', swell);
			gl.uniform4fv(gl.getUniformLocation(program, 'auditShore'), shore);
			const frames = [];
			for (const displacement of [0, 1]) {
				set('uDisplace', displacement); gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS);
				gl.drawArrays(gl.POINTS, 0, positions.length / 3); gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
				gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output); frames.push(output.slice());
			}
			for (let i = 0; i < positions.length; i += 3) {
				const gap = Math.hypot(...[0, 1, 2].map(k => frames[1][i + k] - frames[0][i + k]));
				assert(Number.isFinite(gap), 'Non-finite sea displacement');
				if (i < boundaryCount * 3) { maxGap = Math.max(maxGap, gap); samples++; }
				else nearMotion = Math.max(nearMotion, gap);
			}
			controls.push(...frames[1].slice(boundaryCount * 3));
		}
		// Follow identical world vertices across the 64-unit mesh snap while the
		// player moves only 0.002 units. A fade tied to the snapped centre jumps.
		const snapFrames = [], worldPoints = [3584, 0, 256, 3648, 0, 0, 4096, 0, 0];
		set('uTime', 2.7); set('uSwell', 2.7); set('uSurfEnergy', 2.7); set('uDisplace', 1);
		gl.uniform4fv(gl.getUniformLocation(program, 'auditShore'), [-1000, 0, 1000, 0]);
		for (const [center, camera] of [[0, 31.999], [64, 32.001]]) {
			const local = new Float32Array(worldPoints.map((v, i) => i % 3 === 0 ? v - center : v));
			gl.bindBuffer(gl.ARRAY_BUFFER, input); gl.bufferData(gl.ARRAY_BUFFER, local, gl.STATIC_DRAW);
			set('modelMatrix', new THREE.Matrix4().makeTranslation(center, 0, 0)); set('uSeaCenter', new THREE.Vector2(center, 0));
			set('uCameraPos', new THREE.Vector3(camera, 11, 0));
			gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, 3);
			gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
			const frame = new Float32Array(9); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, frame); snapFrames.push(frame);
		}
		const maxSnapJump = Math.max(...snapFrames[0].map((v, i) => Math.abs(v - snapFrames[1][i])));
		return { extent, boundaryVertices: boundaryCount, samples, maxGap, nearMotion, maxSnapJump, controls };
	} finally {
		gl.deleteBuffer(input); gl.deleteBuffer(buffer); gl.deleteTransformFeedback(feedback); gl.deleteVertexArray(vao);
		shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program); gl.getExtension('WEBGL_lose_context')?.loseContext();
	}
}

// Render actual generated plants with their production materials. Orthographic
// inspection keeps subpixel objects readable; it does not change their distance.
export function measureSmallPlants(debug = window.__debug) {
	const { renderer, terrain } = debug, v = terrain.vegetation;
	const scene = new THREE.Scene(); scene.background = new THREE.Color(0.04, 0.04, 0.04);
	scene.add(new THREE.AmbientLight(0xffffff, 2));
	const moon = new THREE.DirectionalLight(0xffffff, 2); moon.position.set(0, 50, 30); scene.add(moon);
	const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 3000);
	const target = new THREE.WebGLRenderTarget(192, 192), pixels = new Uint8Array(192 * 192 * 4);
	const previousTarget = renderer.getRenderTarget(), previousCamera = v.fadeUniforms?.uVegetationCamera.value.clone();
	const saved = v.uniformSets.map(u => [u.uTime.value, u.uWind.value, u.uPulse.value]);
	const lineSaved = ['uTime', 'uWind', 'uPulse'].map(k => v.lineUniforms[k].value);
	const hueSaved = [v.hueUniform.value, v.lineUniforms.uHue.value];
	const riverTime = v.riverEcology.material; // Its time comes from the terrain uniform.
	const terrainTime = debug.shared.terrainUniforms.uTime.value;
	const meshes = [...v.chunks.values()].flatMap(c => c.meshes), fixtures = [];
	for (const [kind, material] of [['blade', v.bladeMaterial], ['shrub', v.shrubMaterial], ['sprout', v.sproutMaterial], ['crystal', v.crystalMaterial], ['river-plants', riverTime]]) {
		const source = meshes.find(m => m.material === material && m.count > 0);
		if (!source && kind !== 'shrub') continue;
		const mesh = new THREE.InstancedMesh((source?.geometry || v.shrubs[0]).clone(), material, 1), matrix = new THREE.Matrix4();
		if (source) source.getMatrixAt(0, matrix);
		else mesh.geometry.setAttribute('aBorn', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
		// A fixed blade base survives the production shader's existing hash-based
		// thinning. CPU double-precision hashes do not predict GPU float hashes.
		if (kind === 'blade') matrix.setPosition(0, matrix.elements[13], 0);
		mesh.setMatrixAt(0, matrix); mesh.frustumCulled = false;
		if (mesh.geometry.attributes.aBorn) { mesh.geometry.attributes.aBorn.array.fill(0); mesh.geometry.attributes.aBorn.needsUpdate = true; }
		fixtures.push({ kind, mesh, base: new THREE.Vector3().setFromMatrixPosition(matrix) });
	}
	for (const [kind, type] of [['tuft', 0], ['reed', 1], ['crystal-lines', 2]]) {
		let found;
		for (const chunk of v.chunks.values()) {
			const group = chunk.groups.find(g => g.ranges), source = chunk.meshes.find(m => m.material === v.lineMaterial);
			if (!source || !group) continue;
			const info = source.geometry.attributes.aInfo;
			const range = group.ranges.find(([s, e]) => e > s && info.getZ(s) === type);
			if (!range) continue;
			const mesh = new THREE.LineSegments(source.geometry.clone(), v.lineMaterial); mesh.frustumCulled = false;
			mesh.geometry.setDrawRange(range[0], range[1] - range[0]); mesh.geometry.attributes.aBorn.array.fill(0); mesh.geometry.attributes.aBorn.needsUpdate = true;
			const base = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.aBase, range[0]);
			found = { kind, mesh, base }; break;
		}
		if (found) fixtures.push(found);
	}
	const distances = [100, 640, 720, 800, 880, 960, 1024], reports = [], images = [];
	try {
		v.hueUniform.value = 0.82; v.lineUniforms.uHue.value = 0.82;
		for (const u of v.uniformSets) { u.uTime.value = 100; u.uWind.value = 8; u.uPulse.value = 1; }
		v.lineUniforms.uTime.value = 100; v.lineUniforms.uWind.value = 8; v.lineUniforms.uPulse.value = 1; debug.shared.terrainUniforms.uTime.value = 100;
		renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, 192, 192, pixels);
		const background = pixels.slice();
		for (const { kind, mesh, base } of fixtures) {
			scene.add(mesh); const counts = [], hashes = [];
			for (const distance of distances) {
				camera.position.set(base.x, base.y + 12, base.z + distance); camera.lookAt(base.x, base.y + 5, base.z); camera.updateMatrixWorld(true);
				v.fadeUniforms?.uVegetationCamera.value.set(camera.position.x, camera.position.z);
				renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, 192, 192, pixels);
				let count = 0, hash = 2166136261;
				for (let i = 0; i < pixels.length; i += 4) if ([0, 1, 2].some(k => Math.abs(pixels[i + k] - background[i + k]) > 1)) count++;
				for (const x of pixels) hash = Math.imul(hash ^ x, 16777619) >>> 0;
				counts.push(count); hashes.push(hash);
				const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
				const flipped = new Uint8ClampedArray(pixels.length);
				for (let row = 0; row < 192; row++) flipped.set(pixels.subarray(row * 768, (row + 1) * 768), (191 - row) * 768);
				canvas.getContext('2d').putImageData(new ImageData(flipped, 192, 192), 0, 0);
				images.push({ kind, distance, data: canvas.toDataURL() });
			}
			reports.push({ kind, base: base.toArray(), counts, hashes }); scene.remove(mesh);
		}
		return { distances, reports, images };
	} finally {
		renderer.setRenderTarget(previousTarget); target.dispose();
		fixtures.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.dispose?.(); });
		v.uniformSets.forEach((u, i) => { [u.uTime.value, u.uWind.value, u.uPulse.value] = saved[i]; });
		['uTime', 'uWind', 'uPulse'].forEach((k, i) => { v.lineUniforms[k].value = lineSaved[i]; });
		debug.shared.terrainUniforms.uTime.value = terrainTime;
		[v.hueUniform.value, v.lineUniforms.uHue.value] = hueSaved;
		if (previousCamera) v.fadeUniforms.uVegetationCamera.value.copy(previousCamera);
	}
}

export function assertDistanceTransitions(ocean, plants) {
	assert(ocean.maxGap < 0.001, `Ocean edge separates from horizon by ${ocean.maxGap}`);
	assert(ocean.nearMotion > 0.1, 'Near waves were flattened too');
	assert(ocean.maxSnapJump < 0.001, `Ocean fade jumps at a mesh snap by ${ocean.maxSnapJump}`);
	assert(plants.reports.length === 8, 'Not all production plant materials were exercised');
	for (const r of plants.reports) {
		assert(r.counts[0] > 0, `${r.kind}: empty near control`);
		assert(r.counts.at(-1) === 0 && r.counts.at(-2) === 0, `${r.kind}: still draws at the deletion boundary`);
	}
}
