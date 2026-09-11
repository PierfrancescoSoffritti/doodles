import * as THREE from 'three';
import { setPebbleLight } from '../js/world/fauna/PebbleLighting.js';
import { FaunaModel } from '../js/world/fauna/FaunaModel.js?v=player-notes-13';
import { PebbleMeshes } from '../js/world/fauna/PebbleMeshes.js?v=pebble-full-1';
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
			desired.set(model.listener.x, model.listener.y, model.listener.z).sub(eyeWorld);
   const e=c.pebble.eyes[j]; desired.y*=Math.max(.025,1-(e.prevBlink+e.blink)*.5); desired.normalize();
			if (gaze.dot(desired) < 0.99999) throw new Error('Pupil misses the player from the actual eye center');
			eyeCenter.set(0, 0, 0).applyMatrix4(eyeMatrix).applyMatrix4(shellMatrix);
			if (!eyeMatrix.elements.every(Number.isFinite) || eyeCenter.y < 0.65 || eyeCenter.y > 2+14/c.size) throw new Error('Eye is detached from shell or buried inside it');
		}
	};
	checkEyes();
	// The locomotion fixture keeps its original unobstructed path.
	group.stones = [];
	model.listener = { x: c.pos.x + 4, y: c.ground + 11, z: c.pos.z };
	const matrix = new THREE.Matrix4(), end = new THREE.Vector3(); let worst = null; let contacts = 0, error = 0, maxStep = 0, previous = null; const sprintFeet=[];
	for (let i = 0; i < 240; i++) {
		model.step(1 / 30); meshes.update(model, 0.5); checkEyes();
		if (previous) maxStep = Math.max(maxStep, Math.hypot(c.renderPosition.x - previous.x, c.renderPosition.y - previous.y, c.renderPosition.z - previous.z));
		previous = { ...c.renderPosition };
		if(c.speed>40 && c.pebble.stand>.98) {
   meshes.bodies.getMatrixAt(0,shellMatrix);shellMatrix.invert();
   meshes.legs.getMatrixAt(1,matrix);end.set(0,.5,0).applyMatrix4(matrix).applyMatrix4(shellMatrix);sprintFeet.push(end.clone());
  }
  if (c.speed>14 || !c.feet || c.pebble.stand < 0.98 || c.pebble.prevStand < 0.98) continue;
		for (let j = 0; j < 2; j++) {
			const f = c.feet[j]; if (f.swing >= 0 || Math.hypot(f.pos.x - f.prev.x, f.pos.y - f.prev.y, f.pos.z - f.prev.z) > 0.001) continue;
			meshes.legs.getMatrixAt(j * 2 + 1, matrix); end.set(0, 0.5, 0).applyMatrix4(matrix);
			const distance = Math.hypot(end.x - f.pos.x, end.y - f.pos.y, end.z - f.pos.z);
			if (distance > error) worst = { frame: i, state: c.pebble.state, speed: c.speed, foot: j, pos: { ...c.pos }, target: { ...f.pos }, yaw: c.yaw, size: c.size };
			error = Math.max(error, distance); contacts++;
		}
	}
	if(sprintFeet.length<4 || Math.max(...sprintFeet.map(p=>p.x))-Math.min(...sprintFeet.map(p=>p.x))<.6 || Math.max(...sprintFeet.map(p=>p.y))-Math.min(...sprintFeet.map(p=>p.y))<.2)throw new Error('Sprint legs freeze at display frame rate');
	if (contacts < 15 || error > 0.08) throw new Error(`Rendered pebble feet lose contact: ${error.toFixed(3)} (${contacts} samples) ${JSON.stringify(worst)}`);
	if (meshes.legs.count !== 0 || c.pebble.stand !== 0) throw new Error('Legs remain visible after settling');
	if (maxStep > 138 * Math.sqrt(c.size) / 30 + 0.02) throw new Error('Pebble render interpolation jumps');
	// Each eyelid closes its own bulb and pupil without flattening the other eye.
 c.pebble.eyes[0].blink=c.pebble.eyes[0].prevBlink=1;
 c.pebble.eyes[1].blink=c.pebble.eyes[1].prevBlink=0;
 meshes.update(model,.5);
 meshes.eyes.bulbs.getMatrixAt(0,matrix);const closed=matrix.elements[5]/matrix.elements[0];
 meshes.eyes.bulbs.getMatrixAt(1,matrix);const open=matrix.elements[5]/matrix.elements[0];
 if(closed>.03 || open<.99)throw new Error('Eyes do not blink independently');
 for(const e of c.pebble.eyes)e.blink=e.prevBlink=0;
 // A rendered frame between safe ticks must clear the ridge between them.
	c.prev={...c.pos,x:c.pos.x-1};c.pos.x+=1;
	group.sample=()=>({cave:true,ground:c.ground+2,clearance:30,daylight:0});
	meshes.update(model,.5);meshes.bodies.getMatrixAt(0,matrix);
	if(!matrix.elements.every(Number.isFinite) || matrix.elements[13]<c.ground+2+.55*c.size-.001)throw new Error('Render interpolation cuts through cave floor');
 // The shell stays submerged while both eyes remain above the stream surface.
 group.sample=()=>({cave:true,ground:c.ground-5,water:c.ground+3,clearance:30,daylight:0});
 for(const eye of c.pebble.eyes)eye.extension=eye.prevExtension=0;
 meshes.update(model,.5);meshes.bodies.getMatrixAt(0,matrix);
 if(!matrix.elements.every(Number.isFinite) || matrix.elements[13]>c.ground+3-.5*c.size || matrix.elements[13]<c.ground+3-.8*c.size-.001)throw new Error('Rendered shell must be submerged at a stable depth');
 for(let i=0;i<2;i++) {
  meshes.eyes.bulbs.getMatrixAt(i,matrix);
  if(!matrix.elements.every(Number.isFinite) || matrix.elements[13]<c.ground+3+.45*c.size)throw new Error('Rendered eyes disappear under cave water');
 }
	// Rotated tilt probes can leave the valid floor despite a supported footprint.
	group.sample=(x,z)=>({ground:Math.abs(x)>.6 && Math.abs(z)>.6?NaN:2,cave:true,water:-4,clearance:20,slope:0,hardness:1,wet:0,forest:0});
	c.pos={x:0,y:3.5,z:0};c.prev={...c.pos};c.ground=2;c.size=1;c.yaw=c.prevYaw=Math.PI/4;
	Object.assign(c.pebble,{state:'flee',stand:1,prevStand:1,origin:{...c.pos},refuge:{x:20,z:-20},heading:-Math.PI/4,steerAt:model.time+2});
	model.step(1/30);meshes.update(model,.5);
	for(const mesh of [meshes.bodies,meshes.legs,meshes.eyes.stalks,meshes.eyes.bulbs,meshes.eyes.pupils]) for(let i=0;i<mesh.count;i++) {
		mesh.getMatrixAt(i,matrix);if(!matrix.elements.every(Number.isFinite))throw new Error(`${mesh.name} disappears at a cave floor edge`);
	}
	c.replyGlow=1;c.replyProgress=.4;c.replyCharged=true;meshes.update(model,.5);
 for(const mesh of [meshes.bodies,meshes.legs,meshes.eyes.stalks,meshes.eyes.bulbs,meshes.eyes.pupils]) {
  if(!mesh.children.some(o=>o.name.endsWith('-reply-mask')))throw new Error(`${mesh.name} has no silhouette mask`);
  for(let i=0;i<mesh.count;i++){
   const strength=mesh===meshes.bodies?mesh.geometry.attributes.aLife.getY(i):mesh.geometry.attributes.aReply.getX(i);
   if(strength!==1||Math.abs(mesh.geometry.attributes.aReplyEcho.getX(i)-.4)>.00001||mesh.geometry.attributes.aReplyEcho.getY(i)!==1)throw new Error(`${mesh.name} does not share its creature's highlight`);
  }
 }
 const geometries = new Set(), materials = new Set(); scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
	geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
	return { kind: 'pebble-rig', caveInterpolation: true, caveWater: true, caveEdgePose: true, sprintAnimation: true, independentBlinks: true, contacts, maxContactError: +error.toFixed(5), maxStep: +maxStep.toFixed(3), hiddenLegs: true, eyes: 2, eyeFrames: 241 };
}

// Sample the real materials before postprocessing, where bloom extracts highlights.
export function checkPebbleAppearance(renderer, world = false) {
 const scene = new THREE.Scene(), shared = { moon: { dir: new THREE.Vector3(0, 1, 0), intensity: 1 }, fogUniforms: createFogUniforms() };
 if(world) {
  shared.terrainUniforms={};
  for(const key of ['uMoonDir','uSunDir'])shared.terrainUniforms[key]={value:new THREE.Vector3(0,1,0)};
  for(const key of ['uMoonColor','uSunColor','uSkyColor','uGroundColor'])shared.terrainUniforms[key]={value:new THREE.Color('#ffffff')};
  for(const key of ['uMoonIntensity','uSunIntensity','uRain'])shared.terrainUniforms[key]={value:1};
  shared.terrainUniforms.uCameraPos={value:new THREE.Vector3()};
  shared.shoreMap={uniforms:{},glsl:'float waterLevelAt(vec2 p){return -4.0;}'};
  shared.weather={uniforms:{uLightning:{value:1},uWeatherSize:{value:1},uWeatherRes:{value:1},uWeatherOrigin:{value:new THREE.Vector2()},uWeatherBlend:{value:0}}};
 }
 const meshes = new PebbleMeshes(scene, shared);
 const sample = () => ({ground:2, water:-4, slope:.08, forest:.1, wet:.2, hardness:.8});
 const model = new FaunaModel('eye-appearance', {sample}), group = model.addGroup('eyes','hopper',0,0,1), c=group.members[0];
 model.creatures=group.members=[c]; c.born=-10; model.observing=true;
 const matrix=new THREE.Matrix4(), center=new THREE.Vector3();
 const settle=(distance)=>{ model.listener={x:c.pos.x+distance,y:13,z:c.pos.z}; for(let i=0;i<90;i++){model.step(1/30);meshes.update(model,1);} for(const e of c.pebble.eyes)e.lift=e.prevLift=0;meshes.eyes.motion.clear();meshes.update(model,1);meshes.eyes.bulbs.getMatrixAt(0,matrix);return center.setFromMatrixPosition(matrix).y; };
 const farHeight=settle(80);
 const stableHead=center.clone();let maxBankDrift=0;
 for(let i=0;i<30;i++){c.prevBank=c.bank=.18*Math.sin(i*.8);model.time+=1/30;meshes.update(model,1);meshes.eyes.bulbs.getMatrixAt(0,matrix);center.setFromMatrixPosition(matrix);maxBankDrift=Math.max(maxBankDrift,center.distanceTo(stableHead));}
 if(maxBankDrift>.8)throw new Error('Tall eyes amplify the body banking');
 const nearHeight=settle(12);
 if(farHeight-nearHeight<3*c.pebble.eyes[0].lengthScale)throw new Error('Eye stalk does not shorten near the player');
 const camera=new THREE.PerspectiveCamera(35,1,.01,30), target=new THREE.WebGLRenderTarget(32,32), pixel=new Uint8Array(4);
 const previousTarget=renderer.getRenderTarget(), previousColor=renderer.getClearColor(new THREE.Color()), previousAlpha=renderer.getClearAlpha();
 const legProbe = new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8), meshes.legs.material, 1); meshes.bodies.getMatrixAt(0,matrix);legProbe.setMatrixAt(0,matrix);legProbe.geometry.setAttribute('aCaveLight',new THREE.InstancedBufferAttribute(new Float32Array(2),2));scene.add(legProbe);
 const stalkProbe=legProbe.clone();stalkProbe.material=meshes.eyes.stalks.material;scene.add(stalkProbe);
 legProbe.onBeforeRender=meshes.legs.onBeforeRender;stalkProbe.onBeforeRender=meshes.eyes.stalks.onBeforeRender;
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
    if(!world && part===meshes.bodies && ((color==='#ff0000' && pixel[0]<=pixel[2]) || (color==='#0000ff' && pixel[2]<=pixel[0])))throw new Error('Body does not follow the scene fog color');
    if(color==='#ffffff' && part===meshes.bodies) bodyLevel=pixel[0]/255;
    if(color==='#ffffff' && part===legProbe) legLevel=pixel[0]/255;
    if(part===meshes.eyes.bulbs) {maxWhite=Math.max(maxWhite,pixel[0]/255);if(pixel[0]/255>=.78 || pixel[0]<90)throw new Error('Eye is dark or enters the bloom threshold');}
   }
  }
  // Bright outdoor fog/sky must not leak into a dark gallery. The cave lamp
  // should reveal the same surfaces again, while eyeballs stay readable.
  shared.fogUniforms.uFogDensity.value=.025;
  shared.fogUniforms.uFogColor.value.set('#ffffff');
  for(const part of [meshes.bodies,legProbe,stalkProbe,meshes.eyes.bulbs]) {
   scene.children.forEach(o=>o.visible=o===part);
   if(part!==meshes.eyes.bulbs){setPebbleLight(part,0,{cave:true,daylight:0});part.geometry.attributes.aCaveLight.needsUpdate=true;}
   part.getMatrixAt(0,matrix);center.setFromMatrixPosition(matrix);
   camera.position.copy(center).add(new THREE.Vector3(0,0,5));camera.lookAt(center);
   shared.caveAmount=0;renderer.render(scene,camera);renderer.readRenderTargetPixels(target,16,16,1,1,pixel);
   const dark=Math.max(...pixel.slice(0,3));
   if(part===meshes.eyes.bulbs){if(dark<90)throw new Error('Eyeballs disappear in cave darkness');continue;}
   if(dark>3)throw new Error(`${part.name || 'leg/stalk'} receives outdoor illumination in a dark cave: ${dark}`);
   shared.caveAmount=1;renderer.render(scene,camera);renderer.readRenderTargetPixels(target,16,16,1,1,pixel);
   if(Math.max(...pixel.slice(0,3))<=dark+3)throw new Error('Cave lamp fails to reveal pebble surfaces');
  }
  if(legLevel>=bodyLevel*.5)throw new Error('Legs are not darker than the rocky body');
 } finally {
  renderer.setRenderTarget(previousTarget);renderer.setClearColor(previousColor,previousAlpha);target.dispose();
  const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }
 return {kind:world?'pebble-world-appearance':'pebble-appearance',caveDarkness:true,caveLamp:true,whiteEyes:true,bodySceneColor:true,maxWhite:+maxWhite.toFixed(3),bloomThreshold:.78,stalkShortening:+(farHeight-nearHeight).toFixed(2),bankDrift:+maxBankDrift.toFixed(3),bodyLevel:+bodyLevel.toFixed(3),legLevel:+legLevel.toFixed(3)};
}
