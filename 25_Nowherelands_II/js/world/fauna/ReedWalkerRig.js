import * as THREE from 'three';
import { ReedWalkerEyes } from './ReedWalkerEyes.js?v=reed-6';
import { reedPose, reedJoint } from './ReedWalkerMotion.js?v=graze-1';
import { reedTusks } from './ReedWalkerTusks.js?v=3';
import { reedWalkerLighting } from './ReedWalkerLighting.js?v=1';
const up = new THREE.Vector3(0, 1, 0);

export class ReedWalkerRig {
 constructor(traits) {
  this.visibility = { value: 1 };
  this.traits = traits; this.root = new THREE.Group(); this.root.scale.setScalar(traits.scale);
  this.shell = new THREE.Group(); this.root.add(this.shell);
  const color = new THREE.Color(traits.color).offsetHSL(traits.hue, 0, 0);
  const material = new THREE.MeshStandardMaterial({ color, roughness: .94, flatShading: true });
  const legMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(.6), roughness: .88, flatShading: true });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color('#bdbaa0'), .3), roughness: 1 });
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) if (positions.getY(i) > 0) positions.setY(i, positions.getY(i) * (traits.crown ?? 1));
  geometry.computeVertexNormals();
  const bodyMaterial = material.clone();
  const body = new THREE.Mesh(geometry, bodyMaterial);
  body.scale.set(traits.length, .87, traits.width); body.castShadow = true; this.shell.add(body); this.body = body;
  // A shallow dorsal seam and a single recessed vent preserve the headless silhouette.
  const surface = new THREE.Mesh(body.geometry, material); surface.scale.copy(body.scale); surface.updateMatrixWorld();
  const ray = new THREE.Raycaster(), seamPoints = [];
  for (let i = 0; i <= 12; i++) {
   ray.set(new THREE.Vector3((i / 12 - .5) * traits.length * 1.3, 3, 0), new THREE.Vector3(0, -1, 0));
   const hit = ray.intersectObject(surface)[0];
   seamPoints.push(hit.point.clone().add(new THREE.Vector3(0, .014, 0)));
  }
  const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPoints), 36, .018, 4, false), rimMaterial);
  this.shell.add(seam); this.seam=seam; this.sprayAnchor=seamPoints[6].clone();
  this.eyes = new ReedWalkerEyes(traits, bodyMaterial);
  this.tusks = reedTusks(traits, surface); this.shell.add(this.tusks);
  for (let i = 0; i < traits.marks; i++) {
   const mark = new THREE.Mesh(new THREE.BoxGeometry(.025, .15 + i % 3 * .035, .018), rimMaterial);
   mark.position.set(-traits.length * .6 + i * traits.length * .18, .18, traits.width * .9); mark.rotation.z = -.3; this.shell.add(mark);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), legMaterial);
  mouth.scale.set(.65, .14, .45); mouth.position.set(.2, -.72, 0); this.shell.add(mouth); this.mouth = mouth;
  this.legs = Array.from({ length: 4 }, (_, i) => {
   const side = i % 2 ? 1 : -1, fore = i < 2 ? 1 : -1;
   const hip = new THREE.Vector3(fore * traits.length * .65, 0, side * traits.width * .64);
   const foot = new THREE.Vector3(fore * traits.length * .94, .04, side * (traits.width + .65));
   const segments = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.085, .12, 1, 6), legMaterial); m.castShadow = true; this.root.add(m); return m; });
   const pad = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), legMaterial); pad.scale.set(traits.foot * 1.3, .09, traits.foot); this.root.add(pad);
   return { hip, foot, side, fore, segments, pad };
  });
  const materials=new Set();this.root.traverse(o=>{if(o.material)materials.add(o.material);});
  for(const material of materials)reedWalkerLighting(material,this.visibility,material===legMaterial);
 }
 update(time, gesture = 'stand', lowering = 0, worldPose = null) {
  const pose = worldPose || reedPose(this.traits, time, gesture, lowering);
  this.shell.position.fromArray(pose.body); this.shell.rotation.z = pose.tilt; this.shell.rotation.x = pose.roll || 0;
  const resting = gesture === 'stand', breath = Math.sin(time * (resting ? .7 : .52));
  this.body.scale.y = .87 + (pose.waterLoad || 0) * .075 + (pose.feeding ? Math.sin(time * 1.7) * .018 : breath * (resting ? .035 : .018));
  this.body.scale.z = this.traits.width * (1 + (pose.waterLoad || 0) * .025);
  this.seam.scale.y = this.body.scale.y / .87;
  this.eyes.update(time);
  this.tusks.scale.y = this.body.scale.y / .87;
  this.mouth.scale.y = .14 + (pose.feeding ? Math.sin(time * 1.7) * .025 : 0);
  this.shell.updateMatrix();
  this.contacts = [];
  for (let i = 0; i < this.legs.length; i++) {
   const leg = this.legs[i], hip = leg.hip.clone().applyMatrix4(this.shell.matrix), foot = new THREE.Vector3().fromArray(pose.feet[i]);
   const knee = new THREE.Vector3().fromArray(reedJoint(hip.toArray(), foot.toArray(), this.traits.legs * .61, leg.side, leg.fore));
   [[hip, knee], [knee, foot]].forEach(([a, b], j) => {
    const m = leg.segments[j], direction = new THREE.Vector3().subVectors(b, a);
    m.position.copy(a).add(b).multiplyScalar(.5); m.scale.y = direction.length(); m.quaternion.setFromUnitVectors(up, direction.normalize());
   });
   leg.pad.position.copy(foot); this.contacts.push(foot.toArray());
  }
  return pose;
 }
 dispose() {
  const geometries = new Set(), materials = new Set();
  this.root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
 }
}
