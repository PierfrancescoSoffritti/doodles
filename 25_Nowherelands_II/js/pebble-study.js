import * as THREE from 'three';
import { FaunaModel } from './world/fauna/FaunaModel.js?v=player-notes-13';
import { PebbleMeshes } from './world/fauna/PebbleMeshes.js?v=outline-2';
import { createFogUniforms } from './world/FogGlsl.js';
import { checkPebbleRendering, checkPebbleAppearance } from '../tests/PebbleRenderChecks.js?v=outline-2';
import { checkFaunaShaders } from '../tests/FaunaShaderChecks.js';

const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ canvas: $('canvas'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#17141e');
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
scene.add(new THREE.HemisphereLight('#d9cbdc', '#302836', 2));
const light = new THREE.DirectionalLight('#eee5d4', 3); light.position.set(-12, 30, 15); scene.add(light);
const shared = { moon: { dir: light.position.clone().normalize(), intensity: 2.5 }, fogUniforms: createFogUniforms() };
shared.fogUniforms.uFogDensity.value = 0;
const root = new THREE.Group(); scene.add(root); const meshes = new PebbleMeshes(root, shared);
const groundGeometry = new THREE.PlaneGeometry(360, 360, 180, 180); groundGeometry.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ color: '#625865', roughness: 1, flatShading: true })); scene.add(ground);
const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.48, 32), new THREE.MeshBasicMaterial({ color: '#e2cb92', side: THREE.DoubleSide })); marker.rotation.x = -Math.PI / 2; scene.add(marker);
let model, subject, destination, paused = false, slow = false, accumulator = 0, last = performance.now();
const target = new THREE.Vector3(); let uneven = true, overviewDistance = 65;
function height(x, z) { return uneven ? Math.sin(x * 0.085) * 0.55 + Math.sin(z * 0.11) * 0.4 + x * 0.035 : 0; }
const sample = (x, z) => ({ ground: height(x, z), water: -8, slope: 0.12, wet: 0.2, forest: 0.08, hardness: 0.83, foam: 0 });
function reset() {
	uneven = $('slope').checked;
	model = new FaunaModel('pebble-study-4', { sample });
	const group = model.addGroup('stones', 'hopper', 0, 0, 1); subject = group.members[0];
	model.time = 3; for (const c of group.members) c.born = -10;
	model.listener = { x: subject.pos.x + 34, y: height(subject.pos.x + 34, subject.pos.z) + 11, z: subject.pos.z };
	destination = null; accumulator = 0; overviewDistance = 65;
	const p = groundGeometry.attributes.position;
	for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)) - 0.015);
	p.needsUpdate = true; groundGeometry.computeVertexNormals();
	target.set(subject.pos.x, subject.pos.y, subject.pos.z); render(1, true);
}
$('approach').onclick = () => {
	const dx = model.listener.x - subject.pos.x, dz = model.listener.z - subject.pos.z, d = Math.hypot(dx, dz) || 1;
	destination = { x: subject.pos.x + dx / d * 3, z: subject.pos.z + dz / d * 3 };
};
$('retreat').onclick = () => {
	const dx = model.listener.x - subject.pos.x, dz = model.listener.z - subject.pos.z, d = Math.hypot(dx, dz) || 1;
	destination = { x: model.listener.x + dx / d * 24, z: model.listener.z + dz / d * 24 };
};
$('reset').onclick = reset; $('slope').onchange = reset;
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Play' : 'Pause'; };
$('slow').onclick = () => { slow = !slow; $('slow').setAttribute('aria-pressed', String(slow)); };
$('step').onclick = () => { paused = true; $('pause').textContent = 'Play'; step(); render(1); };
$('view').onchange = () => render(1, true);
function step() {
	if (destination) {
		const dx = destination.x - model.listener.x, dz = destination.z - model.listener.z, d = Math.hypot(dx, dz);
		const stride = Math.min(d, ($('pace').value === 'run' ? 18 : 4.5) / 30);
		model.listener.x += dx / Math.max(d, 0.001) * stride; model.listener.z += dz / Math.max(d, 0.001) * stride;
		model.listener.y = height(model.listener.x, model.listener.z) + 11;
		if (d < 0.1) destination = null;
	}
	model.step(1 / 30);
}
function render(alpha, snap = false) {
	meshes.update(model, alpha);
	marker.position.set(model.listener.x, height(model.listener.x, model.listener.z) + 0.045, model.listener.z);
	const view = $('view').value, patch = view === 'patch';
	const points = [subject.group.home, ...subject.group.members.map(c => c.renderPosition || c.pos)];
	const lowX = Math.min(...points.map(p => p.x)), highX = Math.max(...points.map(p => p.x));
	const lowZ = Math.min(...points.map(p => p.z)), highZ = Math.max(...points.map(p => p.z));
	const center = { x: (lowX + highX) / 2, z: (lowZ + highZ) / 2, y: 0 };
	const radius = Math.max(...points.map(p => Math.hypot(p.x - center.x, p.z - center.z)));
	const desiredDistance = Math.max(65, radius * 3.1);
	overviewDistance += (desiredDistance - overviewDistance) * (snap ? 1 : 0.1);
	const p = patch ? center : subject.renderPosition;
	target.lerp(new THREE.Vector3(p.x, patch ? 2 : p.y + 3.5, p.z), snap ? 1 : 0.12);
	const dirs = { patch: [0.7, 0.8, 1], close: [0.7, 0.38, 1], side: [0, 0.12, 1], front: [1, 0.12, 0], top: [0, 1, 0.001] };
	camera.position.fromArray(dirs[view]).normalize().multiplyScalar(patch ? overviewDistance : 20).add(target);
	camera.lookAt(target); renderer.render(scene, camera);
	const states = { rest: 'Resting · watchful eyes', notice: 'Alert · watching you', rise: 'Startled · unfolding', flee: 'Scattering at full speed', regroup: 'Hurrying back to the colony', wait: 'Waiting upright for the colony', brake: 'Braking · finding balance', settle: 'Settling back into stone' };
	$('status').textContent = states[subject.pebble.state];
	$('detail').textContent = `${model.creatures.length} animals among ${subject.group.stones.length} stones · ${subject.speed.toFixed(1)} speed · ${Math.hypot(subject.pos.x - model.listener.x, subject.pos.z - model.listener.z).toFixed(1)} away`;
	document.body.dataset.pebble = JSON.stringify({ state: subject.pebble.state, stand: subject.pebble.stand, speed: subject.speed, steps: subject.pebble.steps, escapes: subject.pebble.escapes, legs: meshes.legs.count, eyes: subject.pebble.eyes.map(e => ({ extension: e.extension, yaw: e.yaw, pitch: e.pitch, attention: e.attention, dilation: e.dilation })), reunion: subject.group.reunion, time: model.time, states: model.creatures.map(c => c.pebble.state), position: subject.pos, members: model.creatures.map(c => ({ state: c.pebble.state, speed: c.speed, escapes: c.pebble.escapes, reunited: c.pebble.reunited, stand: c.pebble.stand, position: c.pos })) });
}
function resize() {
	renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
	camera.setViewOffset(innerWidth, innerHeight, -Math.min(165, innerWidth * 0.19), -20, innerWidth, innerHeight);
}
addEventListener('resize', resize); resize(); reset();
function frame(now) {
	requestAnimationFrame(frame); const dt = Math.min((now - last) / 1000, 0.08) * (slow ? 0.2 : 1); last = now;
	if (!paused) { accumulator += dt; while (accumulator >= 1 / 30) { step(); accumulator -= 1 / 30; } }
	render(paused ? 1 : accumulator * 30);
}
requestAnimationFrame(frame);
try {
	const reports = [...checkFaunaShaders(), checkPebbleRendering(), checkPebbleAppearance(renderer), checkPebbleAppearance(renderer, true)]; $('check').textContent = 'Rigid shell · planted feet · eye rig verified';
	document.body.dataset.shaderChecks = JSON.stringify(reports); document.body.dataset.status = 'pass';
} catch (e) { $('check').textContent = e.message; document.body.dataset.status = 'fail'; console.error(e); }
