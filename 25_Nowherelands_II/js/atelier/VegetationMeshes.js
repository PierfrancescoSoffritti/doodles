import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Random } from '../core/Random.js';

const up = new THREE.Vector3(0, 1, 0);
const restingBulb = new THREE.Color('#f4f0eb'), answeringBulb = new THREE.Color('#ffbd6e');
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness:.88, flatShading:true, ...extra});
function addMesh(parent, geometry, mat) {
 const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function tube(parent, a, b, ra, rb, mat, sides = 5) {
 const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.sub(start);
 const mesh = addMesh(parent, new THREE.CylinderGeometry(rb, ra, direction.length(), sides), mat);
 mesh.position.copy(start).addScaledVector(direction, .5); mesh.quaternion.setFromUnitVectors(up, direction.normalize()); return mesh;
}
function surface(points, triangles) {
 const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
 g.setIndex(triangles); g.computeVertexNormals(); return g;
}
// Folded opaque leaf, with a central ridge and a clearly tapered tip.
function leafGeometry(length, width, taper = .65) {
 const points = [[0,0,0],[-width*.5,-length*.28,0],[0,-length*.28,width*.17],[width*.5,-length*.28,0],
  [-width*taper*.5,-length*.75,.06],[0,-length*.75,width*.17+.06],[width*taper*.5,-length*.75,.06],[0,-length,.13]];
 return surface(points, [0,1,2,0,2,3,1,4,5,1,5,2,2,5,6,2,6,3,4,7,5,5,7,6]);
}
function huskGeometry(size, worn) {
 // One continuous shell: the three lobes share their shoulder and rim vertices.
 // Only the scalloped lower mouth is open, including on weathered specimens.
 const count = 12, points = [[0,0,0]], triangles = [];
 for (let ring = 0; ring < 2; ring++) for (let i = 0; i < count; i++) {
  const angle = i / count * Math.PI * 2, fold = Math.cos(angle * 3);
  const radius = ring ? .96 + .12 * fold : .79 + .06 * fold;
  const wear = worn && ring ? .28 * Math.max(0, Math.cos(angle)) ** 8 : 0;
  const y = ring ? -1.3 - .2 * fold + wear : -.52;
  points.push([Math.sin(angle)*radius*size,y*size,Math.cos(angle)*radius*size]);
 }
 for (let i = 0; i < count; i++) {
  const next = (i+1)%count, a = 1+i, b = 1+next, c = 1+count+i, d = 1+count+next;
  triangles.push(0,a,b, a,c,d, a,d,b);
 }
 return surface(points, triangles);
}
function bulbGeometry(size, phase) {
 // An uneven seed-like sphere; deform coincident vertices identically to keep it closed.
 const geometry = new THREE.IcosahedronGeometry(1, 1), positions = geometry.attributes.position;
 for (let i=0;i<positions.count;i++) {
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  const swell=1+.09*Math.sin(x*3+y*2+phase)*Math.cos(z*3-phase);
  positions.setXYZ(i,(x*swell+.1*y*y)*size*.49,y*swell*size*.59,z*swell*size*.46);
 }
 geometry.computeVertexNormals();return geometry;
}

export class VegetationMeshes {
 constructor(scene, model, camera) {
  this.scene = scene; this.model = model; this.camera = camera; this.root = new THREE.Group(); scene.add(this.root);
  this.stems = []; this.leaves = []; this.mirrors = []; this.picks = [];
  this.bark = material('#37313f'); this.stalk = material('#38313d');
  this.leafMat = material('#75637f', {side:THREE.DoubleSide});
  this.basalMat = material('#515863', {side:THREE.DoubleSide});
  this.hangerMat = material('#4b414b');
  this.metal = material('#b4b6c7', {metalness:.93, roughness:.17, side:THREE.DoubleSide});
  this.frameMat = material('#a092a9', {metalness:.65, roughness:.35});
  for (const plant of model.plants) {
   const group = new THREE.Group(); group.position.set(plant.x,plant.y||0,plant.z); group.scale.setScalar(plant.scale); group.rotation.y = plant.yaw;
   this.root.add(group); const rnd = new Random(`${model.seed}:${model.serial}:${plant.id}`);
   if(model.species==='veil-willow')group.scale.x*=rnd.range(.9,1.12);
   if (model.species === 'bell-reed') this.reeds(group, plant); else this.willow(group, plant, rnd);
  }
  this.visitor = addMesh(this.root, new THREE.RingGeometry(.24,.29,32), new THREE.MeshBasicMaterial({color:'#c5a06a',side:THREE.DoubleSide,transparent:true,opacity:.6,depthWrite:false}));
  this.visitor.rotation.x = -Math.PI/2; this.visitor.visible = false;
 }
 reeds(group, plant) {
  for (const spec of plant.stems) {
   const base = new THREE.Group(); base.rotation.y = spec.angle; base.position.set(Math.sin(spec.angle)*.1,0,Math.cos(spec.angle)*.1); group.add(base);
   const joints = []; let parent = base;
   for (let j=0;j<4;j++) {
    const joint = new THREE.Group(); parent.add(joint); if(j) joint.position.y = spec.height/4;
    tube(joint,[0,0,0],[0,spec.height/4,0],.028-j*.004,.024-j*.004,this.stalk);
    joints.push(joint); parent = joint;
   }
   const head = new THREE.Group(); head.position.y = spec.height/4; parent.add(head);
   tube(head,[0,0,0],[.1,.13,0],.013,.012,this.stalk);
   tube(head,[.1,.13,0],[.29,.15,0],.012,.011,this.stalk);
   // Continue the hook below the crown, so the shell cannot look suspended in air.
   tube(head,[.29,.15,0],[.39,-.02-spec.size*.3,0],.011,.01,this.stalk);
   const shell = new THREE.Group(); shell.position.set(.39,-.02,0); shell.rotation.z = -.12; head.add(shell);
   const outer = material(new THREE.Color('#997488').offsetHSL(plant.tint,0,plant.tint), {side:THREE.DoubleSide});
   const inner = material('#665052', {side:THREE.DoubleSide,emissive:'#ffbd6e',emissiveIntensity:0});
   const geo = huskGeometry(spec.size,spec.worn);
   addMesh(shell,geo,outer); const lining = addMesh(shell,geo,inner); lining.scale.set(.95,.99,.95); lining.position.y=-.003;
   // Keep the bulb support entirely beneath the crown; its cap must not poke out beside the hook.
   tube(shell,[0,-spec.size*.32,0],[0,-spec.size*1.12,0],.012,.009,this.stalk);
   const bulb = addMesh(shell,bulbGeometry(spec.size,spec.phase),material('#d5cfd0',{
    emissive:restingBulb,emissiveIntensity:.72,roughness:.58,
   }));
   bulb.position.y=-spec.size*1.18;
   shell.userData.stem = spec.id; shell.traverse(o=>{if(o.isMesh){o.userData.plant=plant.id;o.userData.part=spec.id;this.picks.push(o);}});
   this.stems.push({plant,spec,joints,head,shell,inner,bulb});
  }
  for(let i=0;i<3;i++) {
   const leaf = addMesh(group,leafGeometry(plant.form==='young'?.65:1.05,.21),this.basalMat);
   leaf.rotation.set(Math.PI-.4, i*2.1, .35); leaf.position.y=.03;
  }
 }
 willow(group, plant, rnd) {
  const lean = rnd.range(-.45,-.2), twist = rnd.range(-.3,.3);
  const trunk = [[0,0,0],[lean*.45,1.25,twist*.4],[lean,2.55,twist],[lean*.65,3.45,twist*.5]];
  for(let i=0;i<3;i++) tube(group,trunk[i],trunk[i+1],.34-i*.075,.265-i*.065,this.bark,6);
  for(let i=0;i<5;i++){const a=i*1.256; tube(group,[Math.cos(a)*.78,.015,Math.sin(a)*.65],[0,.55,0],.09,.2,this.bark);}
  // Three unequal limbs fan around the trunk, rather than sharing an X/Y plane.
  // Every hanging attachment comes from an actual branch endpoint or segment.
  const anchors = [], pendantAnchors = [], crownTurn = rnd.range(-.18,.18);
  const interpolate = (a,b,t) => a.map((value,i)=>value+(b[i]-value)*t);
  const radial = (angle,radius,height) => [Math.cos(angle)*radius,height,Math.sin(angle)*radius];
  for (let i=0;i<3;i++) {
   const angle = .28 + i*Math.PI*2/3 + crownTurn + rnd.range(-.12,.12);
   const radius = rnd.range(2.45,2.95), height = [4.7,4.35,5.55][i]+rnd.range(-.18,.18);
   const origin = interpolate(trunk[2],trunk[3],[.25,.05,1][i]);
   const elbow = radial(angle-.13,radius*.48,origin[1]+(height-origin[1])*.62);
   const shoulder = radial(angle,radius*.84,height);
   const tip = radial(angle+.13,radius,height-.3);
   const branch = [origin,elbow,shoulder,tip];
   for(let j=0;j<3;j++)tube(group,branch[j],branch[j+1],.18-j*.055,.125-j*.05,this.bark);
   anchors.push({position:tip,angle:angle+.13});
   const forkOrigin = interpolate(elbow,shoulder,.67), forkTip = radial(angle-.43,radius*.94,height-.38);
   tube(group,forkOrigin,forkTip,.065,.016,this.bark);anchors.push({position:forkTip,angle:angle-.43});
   if(i!==2){
    const lowerTip=radial(angle+.5,radius*.72,height-.8);
    tube(group,elbow,lowerTip,.065,.018,this.bark);anchors.push({position:lowerTip,angle:angle+.5});
    pendantAnchors.push(interpolate(origin,elbow,.82));
   }
  }
  for(let i=0;i<anchors.length;i++) {
   const attachment = new THREE.Group(); attachment.position.set(...anchors[i].position); group.add(attachment);
   const phase=rnd.range(0,6.28), length=rnd.range(1.2,1.8);
   attachment.rotation.y=-anchors[i].angle+rnd.range(-.55,.55);
   if(plant.form==='ribbons') this.ribbon(attachment,length,.32,phase,plant);
   else if(plant.form==='sprays') {
    for(let j=0;j<3;j++) {
     const leaf = new THREE.Group(); leaf.rotation.z=(j-1)*.24; leaf.rotation.y=(j-1)*.5; leaf.position.y=-j*.1; attachment.add(leaf);
     this.ribbon(leaf,length*(j===1?1:.76),.34,phase+j*.4,plant);
    }
   } else {
    tube(attachment,[0,0,0],[.06,-length*.85,0],.017,.009,this.hangerMat);
    for(let j=0;j<2;j++) {
     const leaf=new THREE.Group(); leaf.position.set(j? .06:0,-j*length*.6,0); leaf.rotation.z=j?.13:-.18; attachment.add(leaf);
     this.ribbon(leaf,length*.47,.26,phase+j*.4,plant);
    }
   }
   this.leaves.push({pivot:attachment,phase,plant,attachment:true});
  }
  for(const mirror of plant.mirrors) {
   this.pendant(group,pendantAnchors[mirror.id],plant,mirror);
  }
 }
 ribbon(parent,length,width,phase,plant) {
  // Shared rows bend together: separately rotated panels exposed cracks at joints.
  const points=[],triangles=[],widths=[.16,1,.65];
  for(let i=0;i<3;i++){
   const w=width*widths[i],y=-length*i/3;
   points.push([-w/2,y,0],[0,y,w*.16],[w/2,y,0]);
   if(i<2){const a=i*3;triangles.push(a,a+3,a+4,a,a+4,a+1,a+1,a+4,a+5,a+1,a+5,a+2);}
  }
  points.push([0,-length,0]);triangles.push(6,9,7,7,9,8);
  const pivot=new THREE.Group();parent.add(pivot);const geometry=surface(points,triangles);
  addMesh(pivot,geometry,this.leafMat);
  this.leaves.push({pivot,phase,plant,attachment:false,geometry,rest:geometry.attributes.position.array.slice(),length});
 }
 pendant(group,anchor,plant,spec) {
  const pivot=new THREE.Group(); pivot.position.set(...anchor); group.add(pivot);
  const length=spec.id===0?1.28:.92;
  tube(pivot,[0,0,0],[0,-length,0],.016,.01,this.hangerMat);
  const turn=new THREE.Group(); turn.position.y=-length-.32; pivot.add(turn);
  const geometry=new THREE.CircleGeometry(.32,spec.id===0?4:32);
  if(spec.id===0)geometry.rotateZ(Math.PI/2);
  const reflector=new Reflector(geometry,{textureWidth:384,textureHeight:384,clipBias:.01,color:'#b8aebe',multisample:0});
  reflector.material.side=THREE.DoubleSide; reflector.userData.plant=plant.id; reflector.userData.part=spec.id;
  const reflect=reflector.onBeforeRender, reflectionMaterial=reflector.material;
  reflector.onBeforeRender=(renderer,scene,camera)=>{if(camera===this.camera)reflect.call(reflector,renderer,scene,camera);};
  turn.add(reflector); this.picks.push(reflector);
  const frame=addMesh(turn,new THREE.TorusGeometry(.326,.012,4,spec.id===0?4:32),this.frameMat.clone());frame.position.z=.006;
  this.mirrors.push({plant,spec,pivot,turn,reflector,frame,reflectionMaterial,render:reflector.onBeforeRender});
 }
 update(camera) {
  const time=this.model.time, wind=this.model.wind;
  for(const item of this.stems) {
   const {spec,joints,plant}=item, bend=this.model.brushBend(plant), visitor=this.model.visitor();
   const dx=plant.x-visitor.x,dz=plant.z-visitor.z,norm=Math.max(.1,Math.hypot(dx,dz)),yaw=plant.yaw+spec.angle;
   const awayX=(Math.cos(yaw)*dx-Math.sin(yaw)*dz)/norm,awayZ=(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/norm;
   joints.forEach((joint,i)=>{
    joint.rotation.z=-spec.spread*.09-(plant.form==='weathered'?.045:0)+Math.sin(time*1.2+spec.phase-i*.22)*wind*.035-awayX*bend*(i+1)*.28+(spec.nod||0)*(i+1)*.035;
    joint.rotation.x=Math.cos(time*.85+spec.phase)*wind*.018+awayZ*bend*(i+1)*.28;
   });
   item.shell.rotation.z=-.12+Math.sin(time*1.9+spec.phase)*wind*.09+(spec.nod||0);
   item.inner.emissive.copy(restingBulb).lerp(answeringBulb,Math.min(1,spec.energy*2.5));
   item.inner.emissiveIntensity=.035+spec.energy*.65;
   item.bulb.material.emissive.copy(restingBulb).lerp(answeringBulb,Math.min(1,spec.energy*2.5));
   item.bulb.material.emissiveIntensity=.72+spec.energy*7;
  }
  for(const item of this.leaves) {
   item.pivot.rotation.z=Math.sin(time*.72+item.phase)*wind*(item.attachment?.12:.075);
   item.pivot.rotation.x=(item.attachment?0:.055)+Math.cos(time*.57+item.phase)*wind*.055;
   if(item.geometry){
    const positions=item.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
     const t=-item.rest[i*3+1]/item.length,bend=t*t*item.length;
     positions.setXYZ(i,item.rest[i*3]+Math.sin(time*.72+item.phase-t*.65)*wind*.09*bend,item.rest[i*3+1],
      item.rest[i*3+2]+(.09+Math.cos(time*.57+item.phase-t*.7)*wind*.06)*bend);
    }
    positions.needsUpdate=true;item.geometry.computeVertexNormals();
    item.geometry.computeBoundingSphere();
   }
  }
  this.root.updateMatrixWorld(true);
  const position=new THREE.Vector3();
  const nearest=this.mirrors.map(m=>({m,d:m.reflector.getWorldPosition(position).distanceToSquared(camera.position)})).sort((a,b)=>a.d-b.d).slice(0,2).map(x=>x.m);
  for(const m of this.mirrors) {
   m.pivot.rotation.z=Math.sin(time*.9+m.spec.id)*wind*.12+m.spec.swing;
   m.pivot.rotation.x=Math.sin(time*.7+m.plant.phase)*wind*.055;
   m.turn.getWorldPosition(position); const yaw=Math.atan2(camera.position.x-position.x,camera.position.z-position.z)-m.plant.yaw;
   m.turn.rotation.y=Math.max(-.5,Math.min(.5,yaw))*.65+Math.sin(time*.45+m.spec.id)*wind*.2;
   m.frame.material.color.set('#b0a0b9').multiplyScalar(1+m.spec.energy*2);
   const active=nearest.includes(m); m.reflector.material=active?m.reflectionMaterial:this.metal; m.reflector.onBeforeRender=active?m.render:()=>{};
  }
  const visitor=this.model.visitor(); this.visitor.visible=visitor.active; this.visitor.position.set(visitor.x,.02,visitor.z);
 }
 dispose() {
  const geometries=new Set(),materials=new Set([this.bark,this.stalk,this.leafMat,this.basalMat,this.hangerMat,this.metal,this.frameMat]);
  this.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});
  for(const mirror of this.mirrors){mirror.reflector.getRenderTarget().dispose();materials.add(mirror.reflectionMaterial);}
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.root.removeFromParent();
 }
}
