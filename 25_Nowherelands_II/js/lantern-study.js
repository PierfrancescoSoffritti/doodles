import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LanternMiteStudy } from './world/fauna/LanternMiteStudy.js?v=pebble-voice-4b';
import { Random } from './core/Random.js';
import { LanternMiteMeshes } from './world/fauna/LanternMiteMeshes.js?v=outline-2';
import { mountLanternListening } from './atelier/LanternMiteListening.js';

const $ = id => document.getElementById(id);
const model = new LanternMiteStudy();
const renderer = new THREE.WebGLRenderer({ canvas: $('canvas'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#182328');
scene.fog = new THREE.Fog('#182328', 24, 46);
const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 80);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.enablePan = false;
orbit.minDistance = 6; orbit.maxDistance = 27; orbit.maxPolarAngle = Math.PI * 0.48;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.52, 0.45, 0.85));
composer.addPass(new OutputPass());
scene.add(new THREE.HemisphereLight('#c3d4c8', '#29312c', 1.35));
const moon = new THREE.DirectionalLight('#bfdae2', 2.1); moon.position.set(-6, 12, 5); scene.add(moon);
const warm = new THREE.DirectionalLight('#baa280', 0.65); warm.position.set(5, 3, -3); scene.add(warm);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.98, flatShading: true, ...extra });
const earth = mat('#394339'), bark = mat('#514d3d'), barkDark = mat('#373b31'), moss = mat('#5f7151'), stone = mat('#777963');
const sceneryRandom = new Random('lantern-hollow-scenery');
function mesh(geometry, material, position, scale) {
 const object = new THREE.Mesh(geometry, material);
 if (position) object.position.set(...position);
 if (scale) object.scale.set(...scale);
 scene.add(object); return object;
}
mesh(new THREE.CylinderGeometry(6.6, 6.2, 0.5, 70), earth, [0, -0.29, 1]);
mesh(new THREE.CylinderGeometry(6.2, 5.5, 0.7, 60), barkDark, [0, -0.85, 1]);

function root(points, radius, material = bark) {
 const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
 const geometry = new THREE.TubeGeometry(curve, 28, radius, 7, false);
 // Taper exposed ends while preserving a broad supporting base.
 const p = geometry.attributes.position;
 for (let ring = 0; ring <= 28; ring++) {
  const t = ring / 28, center = curve.getPointAt(t), taper = 1 - 0.62 * t;
  for (let side = 0; side <= 7; side++) {
   const index = ring * 8 + side;
   p.setXYZ(index, center.x + (p.getX(index) - center.x) * taper, center.y + (p.getY(index) - center.y) * taper, center.z + (p.getZ(index) - center.z) * taper);
  }
 }
 geometry.computeVertexNormals(); mesh(geometry, material);
}
// An open arch over a shallow recess. The front stays clear for short flights.
root([[-3.7, 0.13, -0.1], [-2.3, 1.0, -0.8], [-1.4, 2.6, -1.7], [0, 3.35, -2.1], [2.1, 2.3, -1.5], [3.0, 0.28, -0.3]], 0.74);
root([[-1.4, 2.6, -1.7], [-2.6, 1.7, -1.4], [-3.4, 0.45, 0.3], [-4.6, 0.11, 2]], 0.42, barkDark);
root([[1.2, 3, -1.9], [2.5, 1.5, -1.25], [3.2, 0.4, 0.8], [4.45, 0.12, 2.5]], 0.48);
root([[-3.5, 0.4, -0.4], [-2.5, 0.23, 0.2], [-1.8, 0.12, 1.2]], 0.28);
root([[2.7, 0.4, -0.4], [2.0, 0.18, 0.55], [2.8, 0.07, 1.7]], 0.25);
mesh(new THREE.SphereGeometry(1, 16, 8), barkDark, [0, 0.32, -1.95], [2.1, 0.64, 0.72]);
for (let i = 0; i < 80; i++) {
 const a = sceneryRandom.range(0, Math.PI * 2), r = sceneryRandom.range(2.4, 5.8);
 const x = Math.cos(a) * r, z = Math.sin(a) * r + 0.2;
 const size = sceneryRandom.range(0.13, 0.48);
 mesh(new THREE.IcosahedronGeometry(1, 0), i % 7 ? moss : stone, [x, size * 0.18, z], [size * 1.5, size * 0.4, size]);
}
for (const mite of model.mites) {
 const supportHeight = mite.perch.y - mite.size;
 mesh(new THREE.IcosahedronGeometry(1, 1), moss, [mite.perch.x, supportHeight / 2, mite.perch.z], [0.3, supportHeight / 2, 0.25]);
}

const mites = new LanternMiteMeshes(scene, { lights: true });
const visitor = mesh(new THREE.RingGeometry(0.31, 0.35, 48), new THREE.MeshBasicMaterial({ color: '#bda56e', side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false }));
visitor.renderOrder = 10;
visitor.rotation.x = -Math.PI / 2;
// The visitor's approach path gives a spatial reference without implying a trail in the world.
const path = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.015, 3.3), new THREE.Vector3(0, 0.015, 7)]);
const line = new THREE.Line(path, new THREE.LineDashedMaterial({ color: '#74806b', dashSize: 0.12, gapSize: 0.16, transparent: true, opacity: 0.28 })); line.computeLineDistances(); scene.add(line);

let paused = false, slow = false, last = performance.now();
const listening = mountLanternListening(model, () => {
 setPaused(false); slow = false; $('slow').setAttribute('aria-pressed', 'false');
});
function setPaused(value) { paused = value; $('pause').textContent = paused ? 'Resume' : 'Pause'; $('pause').setAttribute('aria-pressed', String(paused)); }
$('pause').onclick = () => { if (!paused) listening.stop(); setPaused(!paused); };
$('slow').onclick = () => { listening.stop(); slow = !slow; $('slow').setAttribute('aria-pressed', String(slow)); };
$('reset').onclick = () => { listening.stop(); model.reset(); setPaused(false); };
$('demo').onclick = () => { listening.stop(); model.playEncounter(); setPaused(false); };
for (const button of document.querySelectorAll('[data-action]')) button.onclick = () => { model.command(button.dataset.action); setPaused(false); };
function resetView() {
 orbit.target.set(0, 0.6, 1.15); camera.position.set(8.8, 7.4, 14.8); orbit.update();
}
$('reset-view').onclick = resetView;
function resize() {
 const width = $('stage').clientWidth, height = $('stage').clientHeight;
 renderer.setSize(width, height); composer.setSize(width, height);
 camera.aspect = width / height;
 camera.zoom = Math.min(1, camera.aspect / 1.13);
 camera.updateProjectionMatrix();
 // Preserve the whole hollow on narrow screens.
 camera.setViewOffset(width, height, 0, -height * 0.04, width, height);
}
new ResizeObserver(resize).observe($('stage')); resize(); resetView();

function render() {
 mites.update(model.mites, model.time);
 visitor.position.set(model.visitor.x, model.visitor.y, model.visitor.z);
 const [title, description] = model.caption;
 $('moment').textContent = title; $('description').textContent = description;
 $('playback').textContent = paused ? 'Paused' : model.demo ? 'Encounter playing' : 'Explore at your own pace';
 $('demo').firstChild.textContent = model.demo ? 'Replay the encounter ' : 'Play the encounter ';
 $('clock').textContent = `${Math.floor(model.time / 60)}:${String(Math.floor(model.time % 60)).padStart(2, '0')}`;
 $('progress').style.width = model.demo ? `${Math.min(100, model.time / 35 * 100)}%` : '0%';
 document.body.dataset.study = JSON.stringify({ time: model.time, paused, demo: model.demo, visitor: model.visitor, quiet: model.quiet, states: model.mites.map(m => m.state), positions: model.mites.map(m => m.pos), brightness: model.mites.map(m => m.brightness), contacts: model.mites.map(m => m.contacts), events: model.events });
 orbit.update(); composer.render();
}
document.addEventListener('visibilitychange', () => { last = performance.now(); });
function frame(now) {
 const dt = Math.min((now - last) / 1000, 0.05); last = now;
 if (!paused && !document.hidden) model.update(dt * (slow ? 0.25 : 1));
 listening.update();
 render(); requestAnimationFrame(frame);
}
render(); document.body.dataset.status = 'ready'; requestAnimationFrame(frame);
