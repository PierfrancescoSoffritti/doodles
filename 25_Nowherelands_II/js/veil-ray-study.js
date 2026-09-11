import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VeilRayStudy } from './world/fauna/VeilRayStudy.js?v=player-notes-13';
import { FaunaMeshes } from './world/fauna/FaunaMeshes.js?v=outline-2';
import { createFogUniforms } from './world/FogGlsl.js';
import { Random } from './core/Random.js';
import { mountVeilRayListening } from './atelier/VeilRayListening.js';

const $ = id => document.getElementById(id), model = new VeilRayStudy();
const renderer = new THREE.WebGLRenderer({ canvas: $('canvas'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color('#161321');
scene.fog = new THREE.Fog('#161321', 105, 205);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 350);
const orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.enablePan = false;
orbit.minDistance = 18; orbit.maxDistance = 150; orbit.maxPolarAngle = Math.PI * 0.49;
const shared = { renderer, camera, moon: { dir: new THREE.Vector3(-0.4, 1, 0.2).normalize(), intensity: 1 }, sun: { intensity: 0 }, fogUniforms: createFogUniforms() };
shared.fogUniforms.uFogDensity.value = 0.0002; shared.fogUniforms.uFogColor.value.set('#282136');
const fauna = new FaunaMeshes(scene, shared);
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 0.85)); composer.addPass(new OutputPass());
scene.add(new THREE.HemisphereLight('#c9bddf', '#292535', 1.1));
const moon = new THREE.DirectionalLight('#d2c3ea', 1.8); moon.position.set(-35, 65, 20); scene.add(moon);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, ...extra });
function mesh(geometry, material, position, scale) {
 const obj = new THREE.Mesh(geometry, material); if (position) obj.position.set(...position); if (scale) obj.scale.set(...scale); scene.add(obj); return obj;
}
const earth = mesh(new THREE.RingGeometry(44, 62, 96, 4), mat('#34303c', { side: THREE.DoubleSide }));
earth.rotation.x = -Math.PI / 2; earth.position.set(0, -0.25, -20);
const waterMaterial = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } }, side: THREE.DoubleSide,
 vertexShader: 'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader: `uniform float time;varying vec3 p;void main(){float wave=sin(p.x*.38+p.y*.17-time*.6)*sin(p.y*.32-time*.35);float glint=pow(max(0.,sin(p.x*.15+p.y*.045)),18.)*.05;vec3 c=vec3(.025,.033,.065)+wave*.004+glint*vec3(.8,.65,1.);gl_FragColor=vec4(c,1.);}` });
const water = mesh(new THREE.CircleGeometry(44, 96), waterMaterial); water.rotation.x = -Math.PI / 2; water.position.set(0, -0.12, -20);
const bank = mesh(new THREE.RingGeometry(43.7, 44.15, 96), new THREE.MeshBasicMaterial({ color: '#756880', transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
bank.rotation.x = -Math.PI / 2; bank.position.set(0, 0, -20);
const rnd = new Random('veil-shore');
for (let i = 0; i < 46; i++) {
 const angle = rnd.range(0, Math.PI * 2), radius = rnd.range(45, 58), size = rnd.range(0.5, 2.1);
 const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius - 20;
 if (z > 20 && Math.abs(x) < 24) continue;
 const rock = mesh(new THREE.IcosahedronGeometry(1, 0), mat(i % 3 ? '#4a4353' : '#5c5366'), [x, size * 0.3, z], [size * 1.8, size * 0.7, size]); rock.rotation.y = rnd.range(0, 6.28);
}
// A sparse far-bank reed fringe provides scale without hiding the membrane.
const reedPoints = [];
for (let i = 0; i < 130; i++) {
 const angle = rnd.range(Math.PI, Math.PI * 2), radius = rnd.range(44.5, 48);
 const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius - 20, h = rnd.range(1, 3);
 reedPoints.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 0.4, h, z + 0.2));
}
scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(reedPoints), new THREE.LineBasicMaterial({ color: '#6a586d', transparent: true, opacity: 0.5 })));
const visitor = mesh(new THREE.RingGeometry(1.1, 1.3, 48), new THREE.MeshBasicMaterial({ color: '#d4b984', side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false })); visitor.rotation.x = -Math.PI / 2;
const visitorLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 11, 0)]), new THREE.LineDashedMaterial({ color: '#d4b984', dashSize: 0.4, gapSize: 0.6, transparent: true, opacity: 0.3 })); visitorLine.computeLineDistances(); scene.add(visitorLine);

let paused = false, slow = false, visitorView = false, last = performance.now();
function setPaused(value) { paused = value; $('pause').textContent = value ? 'Resume' : 'Pause'; $('pause').setAttribute('aria-pressed', String(value)); }
const listening = mountVeilRayListening(model, () => { setPaused(false); slow = false; $('slow').setAttribute('aria-pressed', 'false'); });
$('pause').onclick = () => { if (!paused) listening.stop(); setPaused(!paused); };
$('slow').onclick = () => { listening.stop(); slow = !slow; $('slow').setAttribute('aria-pressed', String(slow)); };
$('reset').onclick = () => { listening.stop(); model.reset(); setPaused(false); };
$('demo').onclick = () => { listening.stop(); model.playEncounter(); setPaused(false); };
$('population').onchange = () => { listening.stop(); model.reset(Number($('population').value)); setPaused(false); };
for (const button of document.querySelectorAll('[data-action]')) button.onclick = () => { model.command(button.dataset.action); setPaused(false); };
function resetView() {
 visitorView = false; orbit.enabled = true; $('visitor-view').setAttribute('aria-pressed', 'false');
 orbit.target.set(0, 3, -12); camera.position.set(54, 46, 73); orbit.update();
}
$('reset-view').onclick = resetView;
$('visitor-view').onclick = () => { visitorView = !visitorView; orbit.enabled = !visitorView; $('visitor-view').setAttribute('aria-pressed', String(visitorView)); if (!visitorView) resetView(); };
function resize() {
 const width = $('stage').clientWidth, height = $('stage').clientHeight;
 renderer.setSize(width, height); composer.setSize(width, height); camera.aspect = width / height;
 camera.zoom = Math.min(1, camera.aspect / 1.08); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('stage')); resize(); resetView();
function render() {
 fauna.update(model, 1, 1 / 60, () => ({ ground: -4 }));
 waterMaterial.uniforms.time.value = model.time;
 visitor.position.set(model.visitor.x, 0.03, model.visitor.z); visitorLine.position.set(model.visitor.x, 0.03, model.visitor.z);
 if (visitorView) { camera.position.set(model.visitor.x, 11, model.visitor.z); const p = model.creatures[0].pos; camera.lookAt(p.x, p.y, p.z); } else orbit.update();
 const [title, description] = model.caption; $('moment').textContent = title; $('description').textContent = description;
 $('feedback').textContent = model.lastFeedback;
 $('clock').textContent = `${Math.floor(model.time / 60)}:${String(Math.floor(model.time % 60)).padStart(2, '0')}`;
 $('playback').textContent = paused ? 'Paused' : model.demo ? 'Encounter playing' : 'Explore at your own pace';
 $('progress').style.width = model.demo ? `${Math.min(100, model.time / 62 * 100)}%` : '0%';
 document.body.dataset.study = JSON.stringify({ time: model.time, paused, demo: model.demo, quiet: model.quiet, visitor: model.visitor, states: model.creatures.map(c => c.state), positions: model.creatures.map(c => c.pos), acknowledgments: model.creatures.map(c => c.acknowledgments), contacts: model.creatures.map(c => c.contacts), events: model.events });
 composer.render();
}
document.addEventListener('visibilitychange', () => { last = performance.now(); });
function frame(now) {
 const dt = Math.min((now - last) / 1000, 0.05); last = now;
 if (!paused && !document.hidden) model.update(dt * (slow ? 0.25 : 1));
 listening.update(); render(); requestAnimationFrame(frame);
}
render(); document.body.dataset.status = 'ready'; requestAnimationFrame(frame);
