import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
	if (specifier === 'three') return { url: new URL('../../../common/libs/three-0.185/build/three.module.min.js', import.meta.url).href, shortCircuit: true };
	return next(specifier, context);
} });
const THREE = await import('three');
const { FoliageDepthPrepass } = await import('../../js/fx/FoliageDepthPrepass.js?v=stable-30-3');

function setup() {
	const world = new THREE.Scene(), material = new THREE.MeshLambertMaterial({ alphaTest: .5, side: THREE.DoubleSide });
	const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 2);
	mesh.setMatrixAt(0, new THREE.Matrix4()); mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(4, 0, 0));
	mesh.computeBoundingSphere(); world.add(mesh);
	const calls = [], renderer = { autoClear: true, autoClearColor: true, autoClearDepth: true, autoClearStencil: false,
		getRenderTarget() { return this.target; }, clear(...args) { calls.push(['clear', ...args]); },
		render(scene, camera) { calls.push([scene, camera, this.autoClear]); },
	};
	const original = renderer.render, pass = new FoliageDepthPrepass(renderer, world, material);
	return { world, material, mesh, renderer, calls, original, pass, camera: new THREE.PerspectiveCamera() };
}

test('automatic activation is limited to the measured GPU family and tolerates unavailable GPU metadata', () => {
	const renderer = name => ({ getContext: () => ({ getExtension: () => name ? { UNMASKED_RENDERER_WEBGL: 1 } : null, getParameter: () => name }) });
	assert.equal(FoliageDepthPrepass.supported(renderer('ANGLE (ARM, Mali-G57 MC2, OpenGL ES 3.2)')), true);
	assert.equal(FoliageDepthPrepass.supported(renderer('ANGLE Metal Renderer: Apple M5 Pro')), false);
	assert.equal(FoliageDepthPrepass.supported(renderer('Adreno (TM) 610')), false);
	assert.equal(FoliageDepthPrepass.supported(renderer(null)), false);
});

test('depth precedes world shading without clearing it away, and respects caller clear flags', () => {
	const s = setup(); s.renderer.render(s.world, s.camera);
	assert.deepEqual(s.calls[0], ['clear', true, true, false]);
	assert.equal(s.calls[1][0], s.pass.scene); assert.equal(s.calls[2][0], s.world);
	assert.equal(s.calls[1][2], false); assert.equal(s.calls[2][2], false); assert.equal(s.renderer.autoClear, true);
	s.calls.length = 0; s.renderer.autoClear = false; s.renderer.render(s.world, s.camera);
	assert.equal(s.calls.length, 2); assert.equal(s.renderer.autoClear, false);
	assert.equal(s.pass.material.colorWrite, false); assert.equal(s.pass.material.onBeforeCompile, s.material.onBeforeCompile);
});

test('streamed instances share current buffers and pruning does not dispose source resources', () => {
	const s = setup(); s.pass.sync(); const proxy = s.pass.proxies.get(s.mesh);
	assert.equal(proxy.geometry, s.mesh.geometry); assert.equal(proxy.instanceMatrix, s.mesh.instanceMatrix);
	let disposed = 0; s.mesh.geometry.addEventListener('dispose', () => disposed++);
	s.mesh.visible = false; s.mesh.count = 1; s.mesh.layers.set(3); s.mesh.position.set(2, 3, 4);
	s.mesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(32), 16);
	s.pass.sync(); assert.equal(proxy.visible, false); assert.equal(proxy.count, 1);
	assert.equal(proxy.instanceMatrix, s.mesh.instanceMatrix); assert.equal(proxy.layers.mask, s.mesh.layers.mask);
	assert.deepEqual(proxy.matrix.elements, s.mesh.matrixWorld.elements);
	s.world.remove(s.mesh); s.pass.sync(); assert.equal(s.pass.proxies.size, 0); assert.equal(s.pass.scene.children.length, 0);
	assert.equal(disposed, 0); s.world.add(s.mesh); s.pass.sync(); assert.equal(s.pass.proxies.size, 1);
	s.pass.dispose(); assert.equal(disposed, 0); assert.equal(s.renderer.render, s.original);
});

test('disabled pass, other scenes, override materials and targets without depth retain ordinary rendering', () => {
	for (const kind of ['disabled', 'other', 'override', 'no-depth']) {
		const s = setup(); let scene = s.world;
		if (kind === 'disabled') s.pass.enabled = false;
		if (kind === 'other') scene = new THREE.Scene();
		if (kind === 'override') s.world.overrideMaterial = new THREE.MeshBasicMaterial();
		if (kind === 'no-depth') s.renderer.target = { depthBuffer: false };
		s.renderer.render(scene, s.camera); assert.equal(s.calls.length, 1); assert.equal(s.calls[0][0], scene);
	}
});

test('foliage depth updates transformed roots and manual child matrices without traversing unrelated objects', () => {
	const s = setup(), unrelated = new THREE.Object3D();
	s.world.add(unrelated);
	let visits = 0;
	unrelated.updateMatrixWorld = () => visits++;
	unrelated.updateWorldMatrix = () => visits++;
	s.world.position.set(10, 20, 30);
	s.mesh.matrixAutoUpdate = false;
	s.mesh.matrix.makeTranslation(1, 2, 3);
	s.pass.sync();
	assert.deepEqual(s.pass.proxies.get(s.mesh).matrix.elements, new THREE.Matrix4().makeTranslation(11, 22, 33).elements);
	s.world.position.x = 50;
	s.pass.sync();
	assert.deepEqual(s.pass.proxies.get(s.mesh).matrix.elements, new THREE.Matrix4().makeTranslation(51, 22, 33).elements);
	assert.equal(visits, 0);
	s.mesh.matrixWorldAutoUpdate = false;
	s.mesh.matrixWorld.makeTranslation(4, 5, 6);
	s.pass.sync();
	assert.deepEqual(s.pass.proxies.get(s.mesh).matrix.elements, new THREE.Matrix4().makeTranslation(4, 5, 6).elements);
});

test('nested reflection renders and failures restore renderer state', () => {
	const s = setup(), reflected = new THREE.PerspectiveCamera(); const old = s.pass.originalRender;
	s.pass.originalRender = function(scene, camera) {
		old.call(this, scene, camera);
		if (scene === s.world && camera === s.camera) this.render(scene, reflected);
	};
	s.renderer.render(s.world, s.camera);
	assert.equal(s.calls.filter(c => c[0] === s.pass.scene).length, 2);
	assert.equal(s.calls.filter(c => c[0] === 'clear').length, 1); assert.equal(s.renderer.autoClear, true);
	s.pass.originalRender = () => { throw Error('render failed'); };
	assert.throws(() => s.renderer.render(s.world, s.camera), /render failed/);
	assert.equal(s.renderer.autoClear, true); assert.equal(s.world.overrideMaterial, null);
});
