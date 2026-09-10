import * as THREE from 'three';

export class LanternMiteMeshes {
 constructor(parent, { lights = false } = {}) {
  this.root = new THREE.Group(); parent.add(this.root); this.lights = lights; this.rigs = new Map();
  this.geometry = new THREE.IcosahedronGeometry(1, 2);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,225,144,0.48)'); gradient.addColorStop(0.23, 'rgba(255,206,100,0.2)'); gradient.addColorStop(1, 'rgba(255,197,85,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); this.texture = new THREE.CanvasTexture(canvas);
 }
 create(id) {
  const body = new THREE.Mesh(this.geometry, new THREE.MeshStandardMaterial({ color: '#ceb781', emissive: '#ffd27b', roughness: 0.7, flatShading: true, transparent: true }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  this.root.add(body, halo);
  const light = this.lights ? new THREE.PointLight('#ffd398', 0, 2, 2) : null;
  if (light) this.root.add(light);
  const rig = { body, halo, light }; this.rigs.set(id, rig); return rig;
 }
 update(mites, time, position = m => m.pos, scale = 1, opacity = 1) {
  for (const m of mites) {
   const rig = this.rigs.get(m.id) || this.create(m.id), p = position(m);
   rig.body.position.set(p.x, p.y, p.z);
   const airborne = ['forage', 'visit', 'listen', 'exchange', 'investigate', 'contact', 'return', 'emerge','answering','note-rest'].includes(m.state);
   if (airborne) rig.body.position.y += Math.sin((time - m.since) * 1.7) * 0.03 * scale * Math.min(1, (time - m.since) * 2);
   if (Number.isFinite(p.minY)) rig.body.position.y=Math.max(p.minY,rig.body.position.y);
   rig.body.scale.set(m.size * 0.88 * scale, m.size * scale, m.size * 0.8 * scale);
   rig.body.rotation.set(0, m.phase, 0.12);
   rig.body.material.emissiveIntensity = m.brightness * 3.8;
   rig.body.material.opacity = opacity;
   rig.halo.position.copy(rig.body.position); rig.halo.scale.setScalar(m.size * 9 * scale);
   rig.halo.material.opacity = m.brightness * 0.65 * opacity;
   if (rig.light) { rig.light.position.copy(rig.body.position); rig.light.intensity = m.brightness * 0.65 * opacity; }
  }
 }
 dispose() {
  for (const rig of this.rigs.values()) { rig.body.material.dispose(); rig.halo.material.dispose(); }
  this.geometry.dispose(); this.texture.dispose(); this.rigs.clear(); this.root.removeFromParent();
 }
}
