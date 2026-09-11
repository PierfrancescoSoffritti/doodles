import * as THREE from 'three';
import { lanternAngles, lanternBarkSite, lanternHabitat, lanternHollowSite } from './LanternMiteHabitat.js';
import { LanternMiteColony } from './LanternMiteWorldModel.js?v=player-notes-13';
import { LanternMiteMeshes } from './LanternMiteMeshes.js?v=outline-2';
import { LanternMiteHomeMeshes } from './LanternMiteHomeMeshes.js';
import { LanternMitePaths } from './LanternMitePaths.js';
import { LanternMiteAudio } from '../../audio/LanternMiteVoice.js';

const CAP = 3, RANGE = 440;
export class WorldLanternMites {
 constructor(scene, heightmap, shared, vegetation, seed, groundMaterial) {
  this.hm = heightmap; this.shared = shared; this.vegetation = vegetation; this.seed = seed;
  this.homeMaterials={ground:groundMaterial,rock:vegetation.rockMaterial,bramble:vegetation.lineMaterial};
  this.root = new THREE.Group(); this.root.name = 'Lantern mite colonies'; scene.add(this.root);
  this.colonies = new Map(); this.sites = new WeakMap(); this.rejected = new WeakSet();
  this.time = 0; this.streamAt = 0; this.selected = null; this.observing = false; this.visited = new Set();
  this.ray = new THREE.Raycaster(); this.barkMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  this.glow = new THREE.PointLight('#ffd398', 0, 18, 2); this.root.add(this.glow);
  this.onVisibility = () => { if (document.hidden) this.audio?.silence(); };
  document.addEventListener('visibilitychange', this.onVisibility);
 }
 sample(x, z) {
  const ground = this.hm.sample(x, z), water = this.hm._water, slope = this.hm._slope;
  const hab = this.hm.habitat(x, z);
  return { ground, water, slope, forest: hab.forest, wet: hab.wet, coast: hab.coast,
   roof: this.hm.caves.hasOpening(x, z) || this.hm.caves.surfaceDensity(x, ground, z) > -2 };
 }
 hosts() {
  return [...this.vegetation.chunks.values()].flatMap(c => c.lanternHosts || []);
 }
 siteFor(host) {
  if (this.sites.has(host)) return this.sites.get(host);
  if (this.rejected.has(host)) return null;
  const mesh = new THREE.Mesh(host.geometry, this.barkMaterial);
  mesh.matrixAutoUpdate = false; mesh.matrix.copy(host.matrix); mesh.updateMatrixWorld(true);
  const range = host.radius * 3 + 25;
  const depth = (u, y, n, t) => {
   this.ray.set(new THREE.Vector3(host.x + t.x * u + n.x * range, y, host.z + t.z * u + n.z * range), new THREE.Vector3(-n.x, 0, -n.z));
   this.ray.far = range * 2;
   const hit = this.ray.intersectObject(mesh, false)[0];
   return hit ? (hit.point.x - host.x) * n.x + (hit.point.z - host.z) * n.z : NaN;
  };
  for (const angle of lanternAngles(this.seed, host)) {
   const barkSite = lanternBarkSite(host, (x, z) => this.sample(x, z), depth, this.seed, angle);
   const site = barkSite && lanternHollowSite(barkSite, (x,z)=>this.sample(x,z));
   if (!site) continue;
   let valid = true;
   for (let i = 0; i <= 12 && valid; i++) {
    const p = site.point({ x: 0, y: 0.8, z: 3.6 + i / 12 * 3.4 });
    valid = lanternHabitat(this.sample(p.x, p.z)) && !this.shared.colliders.some(c =>
     Math.hypot(c.position.x - host.x, c.position.z - host.z) > 0.1
     && Math.hypot(c.position.x - p.x, c.position.z - p.z) < c.radius + 2);
   }
   if (!valid) continue;
   // Nearby boulders or another trunk must not intersect the flight volume.
   for (const x of [-5,-3.5,-2,0,2,3.5,5]) for (const z of [-2.5,-1,0.5,2,3.4]) {
    const p = site.point({ x, y: 0.75, z });
    if (this.shared.colliders.some(c => Math.hypot(c.position.x - host.x, c.position.z - host.z) > 0.1
      && Math.hypot(c.position.x - p.x, c.position.z - p.z) < c.radius + site.scale * 0.5)) valid = false;
   }
   if (valid) { this.sites.set(host, site); return site; }
  }
  this.rejected.add(host); return null;
 }
 add(site) {
  if (this.colonies.has(site.id)) return this.colonies.get(site.id);
  const colony = new LanternMiteColony(site);
  colony.meshes = new LanternMiteMeshes(this.root); colony.born = this.time;
  colony.home = new LanternMiteHomeMeshes(this.root,site,colony.model.mites,this.homeMaterials);
  colony.paths=new LanternMitePaths(colony.home,site);
  colony.model.navigate=(from,to)=>colony.paths.route(from,to);
  colony.model.homeExcursion=m=>colony.paths.excursion(m);
  this.shared.colliders.push(...colony.home.colliders);
  colony.home.clearGrass(this.vegetation);
  colony.onSound = (mite, reply) => {
   if (!this.shared.audio || document.hidden || this.shared.fauna.audio?.muted || !this.root.visible || colony.model.sheltered) return;
   if (Math.hypot(mite.pos.x - this.shared.player.position.x, mite.pos.y - this.shared.player.position.y, mite.pos.z - this.shared.player.position.z) > 100) return;
   this.audio ||= new LanternMiteAudio(this.shared.audio, 3);
   this.audio.play(mite, reply, this.shared.audio.now, this.shared.player.position);
  };
  colony.model.onNoteSound=(m,alarm)=>this.shared.playerNotes?.reply('mite',{replyOwner:m,get pos(){return colony.position(m);}},alarm);
  colony.onAlarm = id => this.audio?.silence(id);
  this.colonies.set(site.id, colony); return colony;
 }
 remove(colony) {
  this.audio?.silence(colony.id); colony.meshes.dispose();
  const own=new Set(colony.home.colliders);
  for(let i=this.shared.colliders.length-1;i>=0;i--)if(own.has(this.shared.colliders[i]))this.shared.colliders.splice(i,1);
  colony.home.dispose(); this.colonies.delete(colony.id);
 }
 stream() {
  const p = this.shared.player.position, hosts = this.hosts(), live = new Set(hosts);
  for (const colony of this.colonies.values()) {
   if (!live.has(colony.site.host) || Math.hypot(colony.site.center.x - p.x, colony.site.center.z - p.z) > RANGE * 1.4) {
    this.remove(colony); if (this.selected === colony) this.selected = null;
   } else colony.home.clearGrass(this.vegetation);
  }
  let attempts = 0;
  for (const host of hosts.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))) {
   if (this.colonies.size >= CAP || attempts >= 3) break;
   if (this.colonies.has(host.id) || this.rejected.has(host) || Math.hypot(host.x - p.x, host.z - p.z) > RANGE) continue;
   if ([...this.colonies.values()].some(c => Math.hypot(c.site.host.x - host.x, c.site.host.z - host.z) < 85)) continue;
   attempts++; const site = this.siteFor(host); if (site) this.add(site);
  }
 }
 visit(current = null) {
  const p = this.shared.player.position, hosts = this.hosts().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  const loaded = [...this.colonies.values()], index = loaded.indexOf(current);
  const existing = current ? loaded.find(c=>c!==current&&!this.visited.has(c.id)) : loaded[0];
  let colony = existing;
  if (!colony) for (const host of hosts.slice(0, 40)) {
   if (host.id === current?.id || (current && (this.visited.has(host.id) || Math.hypot(host.x - current.site.host.x, host.z - current.site.host.z) < 85))) continue;
   const site = this.siteFor(host); if (site) { colony = this.add(site); break; }
  }
  if (!colony && current && loaded.length>1) { this.visited.clear(); colony=loaded[(index+1)%loaded.length]; }
  if (!colony) return null;
  if(this.visited.size>256)this.visited.clear();this.visited.add(colony.id);
  this.selected = colony; this.observing = true;
  while (this.colonies.size > CAP) {
   const old = [...this.colonies.values()].filter(c => c !== colony).sort((a, b) =>
    Math.hypot(b.site.center.x - colony.site.center.x, b.site.center.z - colony.site.center.z) - Math.hypot(a.site.center.x - colony.site.center.x, a.site.center.z - colony.site.center.z))[0];
   this.remove(old);
  }
  return colony;
 }
 hearNote(note) {
  if(!this.root.visible||document.hidden)return;
  for(const colony of this.colonies.values())colony.hearNote(note);
 }
 playerNote(charge=0) { return this.shared.playerNotes?.send(charge) || false; }

 update(dt) {
  this.time += dt;
  this.root.visible = this.shared.surfaceStreaming !== false && (this.shared.caveAmount || 0) < 0.4;
  if (!this.root.visible || document.hidden) { this.audio?.silence(); this.glow.intensity = 0; return; }
  if (this.time >= this.streamAt) { this.streamAt = this.time + 2; this.stream(); }
  if (this.shared.fauna.audio?.muted) this.audio?.silence();
  const storm = (this.shared.state.storm || 0) > 0.65 || (this.shared.state.rainVisible || 0) > 0.8;
  let closest = null, closestDistance = 55;
  for (const colony of this.colonies.values()) {
   const daylight = !colony.site.home && this.shared.sun.height > 0.12 && this.shared.sun.intensity > 0.65 && colony.site.forest < 0.6;
   colony.update(Math.min(dt, 0.05), this.shared.player.position, { active: !this.observing && (!this.shared.player.fly || this.guided), sheltered: storm || daylight });
   const d = Math.hypot(colony.site.center.x - this.shared.player.position.x, colony.site.center.z - this.shared.player.position.z);
   colony.meshes.root.visible = d < RANGE;
   colony.home.root.visible = d < RANGE;
   colony.home.update(dt,colony.model);
   if (colony.meshes.root.visible) colony.meshes.update(colony.model.mites, colony.model.time, m => colony.position(m), colony.site.scale, Math.min(1, (this.time - colony.born) / 1.2));
   if (d < closestDistance) { closestDistance = d; closest = colony; }
  }
  if (closest) {
   const p=closest.site.point({x:0,y:1.3,z:0.45});
   this.glow.position.set(p.x,p.y,p.z); this.glow.intensity = closest.home.lightUniforms.uHomeGlow.value * 12 * Math.max(0, 1 - closestDistance / 55);
  } else this.glow.intensity = 0;
 }
 dispose() {
  this.audio?.dispose(); for (const c of [...this.colonies.values()]) this.remove(c);
  this.barkMaterial.dispose(); this.root.removeFromParent(); document.removeEventListener('visibilitychange', this.onVisibility);
 }
}
