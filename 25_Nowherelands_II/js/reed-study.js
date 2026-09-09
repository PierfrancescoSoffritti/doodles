import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Random } from './core/Random.js';
import { reedFamily, reedIndividual } from './world/fauna/ReedWalkerTraits.js?v=reed-7';
import { ReedWalkerRig } from './world/fauna/ReedWalkerRig.js?v=visibility-1';
import { createReedAudioScene } from './audio/ReedWalkerAudioScene.js?v=reed-7';
import { checkReedMix } from '../tests/ReedWalkerMixChecks.js?v=reed-7';

import { createReedSocialStudy } from './world/fauna/ReedWalkerSocialStudy.js?v=graze-1';
import { socialCaption } from './world/fauna/ReedWalkerSocial.js?v=graze-1';

const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ canvas: $('canvas'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9e9df');
const camera = new THREE.PerspectiveCamera(35, 1, .1, 150);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
controls.minDistance = 8; controls.maxDistance = 50; controls.maxPolarAngle = Math.PI * .49;
const ambient = new THREE.HemisphereLight('#e6eedc', '#575445', 2.7); scene.add(ambient);
const sun = new THREE.DirectionalLight('#ffefcc', 3.2); sun.position.set(-9, 19, 9); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 }); sun.shadow.normalBias = .025; scene.add(sun);
const fill = new THREE.DirectionalLight('#bcdedc', 1.1); fill.position.set(10, 7, -8); scene.add(fill);
let members = [], rig, environment, water, reeds, ripples = [], traits, seed = 1, clock = 0, mode = 'stand', paused = false, lowering = 0;
let socialStudy;
let audition, auditionTimer, auditionSerial = 0;
const leafGeometry = new THREE.ConeGeometry(.12, 1, 3);
const reedGeometry = new THREE.CylinderGeometry(.014, .022, 1, 4);

function disposeTree(root) {
 const geometries = new Set(), materials = new Set();
 root.traverse(o => { if (o.geometry && o.geometry !== leafGeometry && o.geometry !== reedGeometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
 geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); scene.remove(root);
}
function createHabitat() {
 if (environment) disposeTree(environment);
 environment = new THREE.Group(); scene.add(environment); const r = new Random('reed-river-diorama');
 const soil = new THREE.Mesh(new THREE.CylinderGeometry(12.8, 12.3, .4, 72), new THREE.MeshStandardMaterial({ color: traits.ground, roughness: 1 })); soil.position.y = -.21; soil.receiveShadow = true; environment.add(soil);
 const positions = [], indices = [];
 for (let i = 0; i <= 60; i++) {
  const x = (i / 60 * 2 - 1) * 12.7, width = Math.sqrt(Math.max(0, 1 - (x / 12.7) ** 2)) * 5.1;
  for (let j = 0; j < 2; j++) positions.push(x, traits.depth, (j ? 1 : -1) * width + Math.sin(x * .25) * .5);
  if (i < 60) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
 }
 const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals();
 water = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: traits.water, roughness: .34, metalness: .13, transparent: true, opacity: .72, side: THREE.DoubleSide, depthWrite: false })); water.renderOrder = 1; environment.add(water);
 const plantMaterial = new THREE.MeshStandardMaterial({ color: '#666f49', roughness: 1, flatShading: true });
 const stemMaterial = new THREE.MeshStandardMaterial({ color: '#6d7050', roughness: 1 });
 const reedCount = traits.reeds * 3;
 reeds = new THREE.InstancedMesh(reedGeometry, stemMaterial, reedCount);
 const leaves = new THREE.InstancedMesh(leafGeometry, plantMaterial, reedCount * 2), dummy = new THREE.Object3D();
 for (let i = 0; i < reedCount; i++) {
  const x = r.range(-11, 11), side = r.chance(.64) ? -1 : 1;
  const z = side * r.range(5.6, 8.8), h = r.range(.7, 2.3);
  const within = Math.hypot(x, z) < 12;
  dummy.position.set(x, h * .5, z); dummy.rotation.set(r.range(-.1, .1), 0, r.range(-.12, .12)); dummy.scale.setScalar(within ? 1 : 0); dummy.scale.y *= h; dummy.updateMatrix(); reeds.setMatrixAt(i, dummy.matrix);
  for (let j = 0; j < 2; j++) { dummy.position.set(x, h * (.4 + j * .3), z); dummy.rotation.set(side * .35, i * 2.39, (j ? 1 : -1) * .35); dummy.scale.set(within ? 1 : 0, h * .6, 1); dummy.updateMatrix(); leaves.setMatrixAt(i * 2 + j, dummy.matrix); }
 }
 reeds.castShadow = true; environment.add(reeds, leaves);
 const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#969385', roughness: 1, flatShading: true });
 const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
 for (let i = 0; i < 32; i++) {
  const a = r.range(0, Math.PI * 2), radius = r.range(10.2, 12), s = r.range(.18, .65);
  const rock = new THREE.Mesh(rockGeometry, stoneMaterial); rock.position.set(Math.cos(a) * radius, s * .18, Math.sin(a) * radius); rock.scale.set(s * 1.3, s * .58, s); rock.rotation.y = a; rock.castShadow = true; rock.receiveShadow = true; environment.add(rock);
 }
 // Small submerged ribbon tufts make the feeding patch legible.
 for (let i = 0; i < 14; i++) { const leaf = new THREE.Mesh(leafGeometry, plantMaterial); leaf.position.set(r.range(-2, 3), .16, r.range(-1.8, 1.8)); leaf.scale.set(.8, .3, .7); leaf.rotation.z = .35; environment.add(leaf); }
 ripples = Array.from({ length: members.length * 4 }, () => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64), new THREE.MeshBasicMaterial({ color: '#c2d6c3', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = traits.depth + .015; ring.renderOrder = 2; environment.add(ring); return ring;
 });
}
function view() {
 for (const member of members) member.rig.root.visible = $('view').value !== 'face' || member.rig === rig;
 if ($('view').value === 'face') {
  controls.target.set(traits.length * traits.scale * .75, traits.legs * traits.scale, 0);
  controls.target.add(rig.root.position);
  camera.position.copy(controls.target).add(new THREE.Vector3(8 + Math.max(0, traits.tuskLength - 1.2) * 2.5, .7, 1.3)); controls.update(); return;
 }
 const dirs = { quarter: [13, 8.5, 16], side: [0, 6.7, 20], front: [20, 6.7, 0] };
 const direction = dirs[$('view').value]; controls.target.set(0, 2.25, 0); camera.position.fromArray(direction).multiplyScalar(socialStudy ? (socialStudy.kind==='catchup'?1.85:1.45) : members.length > 1 ? 1.85 : 1.2); controls.update();
}
function focusMember() {
 const selected = members.find(m => m.role === $('member').value) || members[0];
 rig = selected.rig; traits = selected.traits;
 $('form-title').textContent = members.length > 1 ? `${traits.name} family · ${selected.label}` : traits.name;
 $('specimen').textContent = `${members.length > 1 ? 'FAMILY' : 'SPECIMEN'} ${String(seed).padStart(3, '0')} · ${traits.age.toUpperCase()}`;
 document.body.dataset.specimen = JSON.stringify({ form: traits.form, age: traits.age, seed, pitch: traits.pitch, role: selected.role, sex: traits.sex, tuskLength: traits.tuskLength, tusks: traits.tusks, color: traits.color });
 if ($('view').value === 'face') view();
}
function rebuild() {
 socialStudy=null;
 for (const member of members) { scene.remove(member.rig.root); member.rig.dispose(); }
 const family = $('group').value === 'family';
 const definitions = family ? reedFamily($('form').value, seed, $('children').value === 'auto' ? null : Number($('children').value)) : [{ role: 'individual', traits: reedIndividual($('form').value, seed, $('age').value, $('sex').value), offset: [0, 0, 0], delay: 0 }];
 members = definitions.map(member => {
  const model = new ReedWalkerRig(member.traits); model.root.position.fromArray(member.offset); scene.add(model.root);
  return { ...member, rig: model };
 });
 const selectedRole = $('member').value;
 $('member').replaceChildren(...members.map(m => new Option(`${m.label || 'Individual'} · ${m.traits.age}`, m.role)));
 if (members.some(m => m.role === selectedRole)) $('member').value = selectedRole;
 $('children-field').hidden = !family;
 $('member-field').hidden = !family; $('age-field').hidden = family; $('sex-field').hidden = family;
 $('individual').innerHTML = family ? 'Another family <small>One or two youngsters, different proportions and voices</small>' : 'Another individual <small>Different proportions, wear and voice</small>';
 if(!family && ['catchup','lean'].includes(mode))gesture('stand');
 document.querySelectorAll('[data-family-gesture]').forEach(b=>b.disabled=!family);
 focusMember(); createHabitat(); applyLighting();
 $('place').textContent = traits.place; $('habitat-detail').textContent = traits.detail; clock = 0;
 view();
 if(['catchup','lean'].includes(mode))gesture(mode);
}
function gesture(next) {
 socialStudy=null;
 if(['catchup','lean'].includes(next)) {
  socialStudy=createReedSocialStudy(members,next,seed);
  $('view').value='quarter'; $('member').value='mother';focusMember();view();
 } else {for(const m of members){m.rig.root.position.fromArray(m.offset);m.rig.root.rotation.y=0;}view();}
 mode = next; clock = 0; paused = false; $('pause').textContent = 'Pause'; $('pause').setAttribute('aria-pressed', 'false');
 document.querySelectorAll('[data-gesture]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gesture === mode)));
}
for(const button of document.querySelectorAll('[data-family-gesture]'))button.onclick=()=>gesture(button.dataset.familyGesture);
for (const button of document.querySelectorAll('[data-gesture]')) button.onclick = () => gesture(button.dataset.gesture);
$('lower').oninput = () => { if(socialStudy)gesture('manual'); mode='manual'; lowering = Number($('lower').value) / 100; document.querySelectorAll('[data-gesture]').forEach(b => b.setAttribute('aria-pressed', 'false')); };
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; $('pause').setAttribute('aria-pressed', String(paused)); };
$('view').onchange = () => {if(socialStudy)gesture('stand');view();}; $('reset-view').onclick = view;
$('children').onchange = rebuild; $('group').onchange = rebuild; $('member').onchange = () => {if(socialStudy)gesture('stand');focusMember();};
$('form').onchange = rebuild; $('age').onchange = rebuild; $('sex').onchange = rebuild; $('individual').onclick = () => { seed++; rebuild(); };
function applyLighting() {
 const dark=$('light').value==='world', night=$('light').value!=='day';
 const original=$('original-shading').checked;
 $('stage').classList.toggle('night',night);
 scene.background.set(dark?'#100c1c':night?'#26332f':'#e9e9df');
 renderer.toneMappingExposure=dark?1.05:1.35;
 ambient.intensity=dark?.55:night?.9:2.7;
 ambient.color.set(dark?'#3f1e60':'#e6eedc');ambient.groundColor.set(dark?'#10050d':'#575445');
 sun.intensity=dark?.35:night?1.2:3.2;sun.color.set(dark?'#ff3b22':night?'#bacddd':'#ffefcc');
 fill.intensity=dark?.02:night?.5:1.1;
 for(const m of members){
  m.rig.visibility.value=original?0:1;
  m.rig.root.traverse(o=>{if(o.material?.emissive)o.material.emissive.copy(o.material.color).multiplyScalar(original&&dark?.10:0);});
 }
 $('stage').style.setProperty('--paper',dark?'#100c1c':night?'#26332f':'#e9e9df');
 $('stage').style.setProperty('--ink',night?'#e1e6d9':'#303c37');$('stage').style.setProperty('--muted',night?'#b6c4b6':'#6b776c');
 document.body.dataset.lighting=JSON.stringify({preset:$('light').value,visibility:!original});
}
$('light').onchange=applyLighting;$('original-shading').onchange=applyLighting;

const tabs = [...document.querySelectorAll('[role=tab]')];
function selectTab(button) {
 for (const tab of tabs) { const active = tab === button; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; $('panel-' + tab.dataset.tab).hidden = !active; }
}
for (const [i, tab] of tabs.entries()) { tab.onclick = () => selectTab(tab); tab.onkeydown = e => {
 if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
 e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
 selectTab(tabs[next]); tabs[next].focus();
}; }
async function stopAudio() {
 clearTimeout(auditionTimer); auditionSerial++;
 const current = audition; audition = null;
 $('stop-audio').disabled = true;
 document.querySelectorAll('[data-voice], #background-only').forEach(button => button.disabled = false);
 if (current) await current.dispose();
}
$('stop-audio').onclick = async () => { await stopAudio(); $('sound-status').textContent = 'Stopped.'; };
$('volume').oninput = () => { if (audition) audition.engine.master.gain.setTargetAtTime(.9 * Number($('volume').value) / 100, audition.engine.now, .05); };
async function listen(event) {
 await stopAudio(); const serial = auditionSerial;
 try {
  const ctx = new AudioContext(), current = createReedAudioScene(ctx, { background: $('sound-bed').value }); audition = current; await ctx.resume();
  if (serial !== auditionSerial) { await current.dispose(); return; }
  current.engine.master.gain.value = .9 * Number($('volume').value) / 100;
  current.phrase(current.engine.now + .1);
  const duration = event ? current.audio.play(traits, event, { position: { x: 0, y: 5, z: -Number($('sound-distance').value) }, listener: current.listener, at: current.engine.now + .8 }) + 1.5 : 7;
  $('sound-status').textContent = event ? `Playing ${event} at ${$('sound-distance').value} units with ${$('sound-bed').selectedOptions[0].textContent.toLowerCase()}.` : 'Background alone · compare its level with the creature.';
  document.querySelectorAll('[data-voice], #background-only').forEach(button => button.disabled = true); $('stop-audio').disabled = false;
  auditionTimer = setTimeout(async () => { if (serial !== auditionSerial) return; await stopAudio(); $('sound-status').textContent = 'Select a sound to compare again.'; }, duration * 1000);
 } catch (e) { if (serial !== auditionSerial) return; await stopAudio(); $('sound-status').textContent = 'Audio could not start: ' + e.message; }
}
for (const button of document.querySelectorAll('[data-voice]')) button.onclick = () => listen(button.dataset.voice);
$('background-only').onclick = () => listen(null);
addEventListener('pagehide', () => { void stopAudio(); });
$('audio-check').onclick = async () => {
 $('audio-check').disabled = true;
 try {
  const result = await checkReedMix((i, n) => { $('sound-status').textContent = `Checking the game mix silently… ${i}/${n}`; });
  document.body.dataset.audioChecks = JSON.stringify(result);
  $('sound-status').textContent = result.passed ? `PASS · ${result.reports.length} mix checks: audible nearby, distance falloff, no clipping.` : 'Needs tuning · ' + result.failures.join('; ');
  $('mix-report').textContent = result.reports.map(r => `${r.form}/${r.age}/${r.sex}/${r.event} ${r.distance}u${r.muted ? ' muted' : r.startup ? ' startup' : r.ducked ? ' ducked' : r.count > 1 ? ' ×3' : ''}: ${r.marginDb === null ? 'silent' : r.marginDb.toFixed(1) + ' dB over background'}, peak ${(20 * Math.log10(Math.max(r.peak, .000001))).toFixed(1)} dBFS`).join('\n');
 } catch (e) { $('sound-status').textContent = 'FAIL · ' + e.message; } finally { $('audio-check').disabled = false; }
};
function resize() { const box = $('stage').getBoundingClientRect(); renderer.setSize(box.width, box.height, false); camera.aspect = box.width / box.height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe($('stage'));
rebuild(); view(); resize();
let last = performance.now(), lastReport = -1;
function frame(now) {
 requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now;
 if (!paused) {clock += dt; socialStudy?.update(dt);}
 for (const member of members) {
  if(socialStudy) {
   const m=socialStudy.group.members.find(m=>m.role===member.role);member.rig.root.visible=!!m;
   if(!m){member.pose=member.rig.update(clock);continue;}
   const draw=m.draw;
   member.rig.root.position.set(draw.origin.x,draw.origin.y-1,draw.origin.z);member.rig.root.rotation.y=draw.yaw;
   member.pose=member.rig.update(clock,m.state,0,draw.pose);
   continue;
  }
  // Independent breathing and feeding; the youngster follows the adults' step.
  const localTime = mode === 'stand' ? clock / member.traits.patience + member.delay * 2
   : Math.max(0, clock - member.delay) / member.traits.patience;
  member.pose = member.rig.update(localTime, mode, lowering);
 }
 const selected = members.find(m => m.rig === rig), pose = selected.pose;
 for (let i = 0; i < ripples.length; i++) {
  const member = members[Math.floor(i / 4)], phase = (clock * .24 + (i % 4) * .25) % 1, ring = ripples[i];
  ring.visible = member.pose.feeding && member.rig.root.visible;
  ring.position.x = member.offset[0] + (member.pose.body[0] + .2) * member.traits.scale;
  ring.position.z = member.offset[2]; ring.scale.setScalar((.6 + phase * 2) * member.traits.scale); ring.material.opacity = (1 - phase) * .13;
 }
 if (Math.floor(now / 100) !== lastReport) {
  $('gesture-status').textContent = socialStudy?socialCaption(socialStudy.group.moment):pose.stage;
  document.body.dataset.social=JSON.stringify(socialStudy?{phase:socialStudy.group.moment?.phase||'complete',kind:mode,elapsed:clock,members:socialStudy.group.members.map(m=>({role:m.role,state:m.state,steps:m.steps,origin:m.draw.origin,body:m.draw.pose.body}))}:null); $('lower-value').textContent = Math.round(pose.graze * 100) + '%'; if (mode !== 'manual') $('lower').value = Math.round(pose.graze * 100);
  document.body.dataset.family = JSON.stringify(members.map(m => ({ role: m.role, age: m.traits.age, sex: m.traits.sex, color: m.traits.color, tuskLength: m.traits.tuskLength, scale: m.traits.scale, position: m.rig.root.position.toArray(), graze: m.pose.graze, tilt: m.pose.tilt })));
  document.body.dataset.pose = JSON.stringify({ mode, graze: pose.graze, body: pose.body, tilt: pose.tilt, roll: pose.roll || 0, feet: pose.feet, feeding: pose.feeding, eyes: rig.eyes.eyes.map(eye => ({ openness: eye.openness })) }); lastReport = Math.floor(now / 100);
 }
 controls.update(); renderer.render(scene, camera); document.body.dataset.status = 'ready';
}
requestAnimationFrame(frame);
