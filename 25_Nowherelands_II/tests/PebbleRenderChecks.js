import * as THREE from 'three';
import { FaunaModel } from '../js/world/fauna/FaunaModel.js?v=pebble-perf-2';
import { PebbleMeshes } from '../js/world/fauna/PebbleMeshes.js?v=pebble-perf-2';
import { createFogUniforms } from '../js/world/FogGlsl.js';

// Check the rendered bone endpoint, not just the simulation's intended contact.
// A correct foot target can still slide if an unreachable IK rig clamps it.
export function checkPebbleRendering() {
	const scene = new THREE.Group(), shared = { moon: { dir: new THREE.Vector3(0, 1, 0), intensity: 1 }, fogUniforms: createFogUniforms() };
	const meshes = new PebbleMeshes(scene, shared);
	const sample = (x, z) => ({ ground: 2 + x * 0.08 + z * 0.04, water: -5, slope: 0.09, forest: 0.1, wet: 0.2, hardness: 0.8 });
	const model = new FaunaModel('render-pebble', { sample }), group = model.addGroup('render', 'hopper', 0, 0, 1), c = group.members[0];
	model.creatures = [c]; group.members = [c];  c.born = -10;
	model.listener = { x: 200, y: 13, z: 200 };
	// Streaming can render a colony before its first simulation tick.
	meshes.update(model, 0.3);
	const spawnMatrix = new THREE.Matrix4();
	for (const mesh of [meshes.eyes.bulbs, meshes.eyes.pupils, meshes.eyes.stalks]) {
		mesh.getMatrixAt(0, spawnMatrix);
		if (!spawnMatrix.elements.every(Number.isFinite)) throw new Error('Eye rig is invalid on its first streamed frame');
	}
	model.step(1 / 30); meshes.update(model, 1);
	if (meshes.legs.count !== 0) throw new Error('Resting pebble has visible legs');
	if (!meshes.stones.count || meshes.eyes.bulbs.count !== 2 || meshes.eyes.pupils.count !== 2) throw new Error('Eyes must belong only to living stones');
	const eyeMatrix = new THREE.Matrix4(), pupilMatrix = new THREE.Matrix4(), shellMatrix = new THREE.Matrix4(), eyeCenter = new THREE.Vector3(), eyeWorld = new THREE.Vector3(), gaze = new THREE.Vector3(), desired = new THREE.Vector3();
	const checkEyes = () => {
		meshes.bodies.getMatrixAt(0, shellMatrix); shellMatrix.invert();
		for (let j = 0; j < 2; j++) {
			meshes.eyes.bulbs.getMatrixAt(j, eyeMatrix);
			meshes.eyes.pupils.getMatrixAt(j, pupilMatrix);
			eyeWorld.setFromMatrixPosition(eyeMatrix);
			gaze.setFromMatrixPosition(pupilMatrix).sub(eyeWorld).normalize();
			desired.set(model.listener.x, model.listener.y, model.listener.z).sub(eyeWorld).normalize();
			if (gaze.dot(desired) < 0.99999) throw new Error('Pupil misses the player from the actual eye center');
			eyeCenter.set(0, 0, 0).applyMatrix4(eyeMatrix).applyMatrix4(shellMatrix);
			if (!eyeMatrix.elements.every(Number.isFinite) || eyeCenter.y < 0.65 || eyeCenter.y > 12) throw new Error('Eye is detached from shell or buried inside it');
		}
	};
	checkEyes();
	// The locomotion fixture keeps its original unobstructed path.
	group.stones = [];
	model.listener = { x: c.pos.x + 4, y: c.ground + 11, z: c.pos.z };
	const matrix = new THREE.Matrix4(), end = new THREE.Vector3(); let worst = null; let contacts = 0, error = 0, maxStep = 0, previous = null;
	for (let i = 0; i < 240; i++) {
		model.step(1 / 30); meshes.update(model, 0.5); checkEyes();
		if (previous) maxStep = Math.max(maxStep, Math.hypot(c.renderPosition.x - previous.x, c.renderPosition.y - previous.y, c.renderPosition.z - previous.z));
		previous = { ...c.renderPosition };
		if (!c.feet || c.pebble.stand < 0.98 || c.pebble.prevStand < 0.98) continue;
		for (let j = 0; j < 2; j++) {
			const f = c.feet[j]; if (f.swing >= 0 || Math.hypot(f.pos.x - f.prev.x, f.pos.y - f.prev.y, f.pos.z - f.prev.z) > 0.001) continue;
			meshes.legs.getMatrixAt(j * 2 + 1, matrix); end.set(0, 0.5, 0).applyMatrix4(matrix);
			const distance = Math.hypot(end.x - f.pos.x, end.y - f.pos.y, end.z - f.pos.z);
			if (distance > error) worst = { frame: i, state: c.pebble.state, speed: c.speed, foot: j, pos: { ...c.pos }, target: { ...f.pos }, yaw: c.yaw, size: c.size };
			error = Math.max(error, distance); contacts++;
		}
	}
	if (contacts < 15 || error > 0.08) throw new Error(`Rendered pebble feet lose contact: ${error.toFixed(3)} (${contacts} samples) ${JSON.stringify(worst)}`);
	if (meshes.legs.count !== 0 || c.pebble.stand !== 0) throw new Error('Legs remain visible after settling');
	if (maxStep > 56 * Math.sqrt(c.size) / 30 + 0.02) throw new Error('Pebble render interpolation jumps');
	const geometries = new Set(), materials = new Set(); scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
	geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
	return { kind: 'pebble-rig', contacts, maxContactError: +error.toFixed(5), maxStep: +maxStep.toFixed(3), hiddenLegs: true, eyes: 2, eyeFrames: 241 };
}

// Sample the real materials before postprocessing, where bloom extracts highlights.
export function checkPebbleAppearance(renderer) {
 const scene = new THREE.Scene(), shared = { moon: { dir: new THREE.Vector3(0, 1, 0), intensity: 1 }, fogUniforms: createFogUniforms() };
 const meshes = new PebbleMeshes(scene, shared);
 const sample = () => ({ground:2, water:-4, slope:.08, forest:.1, wet:.2, hardness:.8});
 const model = new FaunaModel('eye-appearance', {sample}), group = model.addGroup('eyes','hopper',0,0,1), c=group.members[0];
 model.creatures=group.members=[c]; c.born=-10; model.observing=true;
 const matrix=new THREE.Matrix4(), center=new THREE.Vector3();
 const settle=(distance)=>{ model.listener={x:c.pos.x+distance,y:13,z:c.pos.z}; for(let i=0;i<90;i++){model.step(1/30);meshes.update(model,1);} meshes.eyes.bulbs.getMatrixAt(0,matrix);return center.setFromMatrixPosition(matrix).y; };
 const farHeight=settle(80);
 const stableHead=center.clone();let maxBankDrift=0;
 for(let i=0;i<30;i++){c.prevBank=c.bank=.18*Math.sin(i*.8);model.time+=1/30;meshes.update(model,1);meshes.eyes.bulbs.getMatrixAt(0,matrix);center.setFromMatrixPosition(matrix);maxBankDrift=Math.max(maxBankDrift,center.distanceTo(stableHead));}
 if(maxBankDrift>.8)throw new Error('Tall eyes amplify the body banking');
 const nearHeight=settle(12);
 if(farHeight-nearHeight<3)throw new Error('Eye stalk does not shorten near the player');
 const camera=new THREE.PerspectiveCamera(35,1,.01,30), target=new THREE.WebGLRenderTarget(32,32), pixel=new Uint8Array(4);
 const previousTarget=renderer.getRenderTarget(), previousColor=renderer.getClearColor(new THREE.Color()), previousAlpha=renderer.getClearAlpha();
 const legProbe = new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8), meshes.legs.material, 1); meshes.bodies.getMatrixAt(0,matrix);legProbe.setMatrixAt(0,matrix);scene.add(legProbe);
 let maxWhite=0, bodyLevel=0, legLevel=0;
 try {
  renderer.setRenderTarget(target); renderer.setClearColor(0,1);
  for(const part of [meshes.eyes.bulbs,meshes.bodies,legProbe]) {
   scene.children.forEach(o=>o.visible=o===part);
   part.getMatrixAt(0,matrix); center.setFromMatrixPosition(matrix);
   camera.position.copy(center).add(new THREE.Vector3(0,0,5));camera.lookAt(center);
   for(const color of ['#ff0000','#0000ff','#ffffff']) {
    shared.fogUniforms.uFogColor.value.set(color);shared.fogUniforms.uFogFar.value.set(color);shared.fogUniforms.uFogDensity.value=.025;
    renderer.render(scene,camera);renderer.readRenderTargetPixels(target,16,16,1,1,pixel);
    if(part===meshes.eyes.bulbs && Math.max(...pixel.slice(0,3))-Math.min(...pixel.slice(0,3))>1)throw new Error('Colored scene tints the white eyeball');
    if(part===legProbe && (pixel[0]>34 || pixel[2]>pixel[1] || pixel[1]>pixel[0]))throw new Error('Charcoal leg palette is bleached or takes the sky hue');
    if(part===meshes.bodies && ((color==='#ff0000' && pixel[0]<=pixel[2]) || (color==='#0000ff' && pixel[2]<=pixel[0])))throw new Error('Body does not follow the scene fog color');
    if(color==='#ffffff' && part===meshes.bodies) bodyLevel=pixel[0]/255;
    if(color==='#ffffff' && part===legProbe) legLevel=pixel[0]/255;
    if(part===meshes.eyes.bulbs) {maxWhite=Math.max(maxWhite,pixel[0]/255);if(pixel[0]/255>=.78 || pixel[0]<90)throw new Error('Eye is dark or enters the bloom threshold');}
   }
  }
  if(legLevel>=bodyLevel*.5)throw new Error('Legs are not darker than the rocky body');
 } finally {
  renderer.setRenderTarget(previousTarget);renderer.setClearColor(previousColor,previousAlpha);target.dispose();
  const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }
 return {kind:'pebble-appearance',whiteEyes:true,bodySceneColor:true,maxWhite:+maxWhite.toFixed(3),bloomThreshold:.78,stalkShortening:+(farHeight-nearHeight).toFixed(2),bankDrift:+maxBankDrift.toFixed(3),bodyLevel:+bodyLevel.toFixed(3),legLevel:+legLevel.toFixed(3)};
}
