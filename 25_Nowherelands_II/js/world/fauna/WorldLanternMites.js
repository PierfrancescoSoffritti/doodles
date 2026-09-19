import { StaticMeshSurface } from './StaticMeshSurface.js?v=stable-30-5';
import * as THREE from 'three';
import { lanternAngles, buildLanternBarkSite, lanternHabitat, buildLanternHollowSite } from './LanternMiteHabitat.js?v=stable-30-3';
import { LanternMiteColony } from './LanternMiteWorldModel.js?v=pebble-voice-4b';
import { LanternMiteMeshes } from './LanternMiteMeshes.js?v=streaming-60-30-19';
import { LanternMiteHomeMeshes } from './LanternMiteHomeMeshes.js?v=stable-30-6';
import { LanternMitePaths } from './LanternMitePaths.js?v=stable-30-22';
import { LanternMiteAudio } from '../../audio/LanternMiteVoice.js?v=stable-30-3';
import { warmLanternMaterials } from './LanternMiteWarmup.js?v=streaming-60-30-19';

const CAP = 3, RANGE = 440;
export class WorldLanternMites {
 constructor(scene, heightmap, shared, vegetation, seed, groundMaterial) {
  this.scene=scene;this.streamWork=null;this.streamWaiting=false;this.streamStats={steps:0,maxStepMs:0,installed:0,cancelled:0};
  this.hm = heightmap; this.shared = shared; this.vegetation = vegetation; this.seed = seed;
  this.homeMaterials={ground:groundMaterial,rock:vegetation.rockMaterial,bramble:vegetation.lineMaterial};
  this.root = new THREE.Group(); this.root.name = 'Lantern mite colonies'; scene.add(this.root);
  this.colonies = new Map(); this.sites = new WeakMap(); this.rejected = new WeakSet();
  this.time = 0; this.streamAt = 0; this.selected = null; this.observing = false; this.visited = new Set();
  this.barkSurfaces = new WeakMap();this.barkHit = new THREE.Vector3();this.ray = new THREE.Raycaster(); this.barkMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
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
  const work=this.buildSite(host);let result;do{result=work.next()}while(!result.done);return result.value;
 }
 *buildSite(host) {
  this.streamStage='habitat';
  if (this.sites.has(host)) return this.sites.get(host);
  if (this.rejected.has(host)) return null;
  let surface=this.barkSurfaces.get(host.geometry);
  if(!surface){surface=new StaticMeshSurface(host.geometry);this.barkSurfaces.set(host.geometry,surface);yield;}
  const range = host.radius * 3 + 25;
  const depth = (u, y, n, t) => {
   this.ray.ray.origin.set(host.x+t.x*u+n.x*range,y,host.z+t.z*u+n.z*range);
   this.ray.ray.direction.set(-n.x,0,-n.z);
   this.ray.far = range * 2;
   const hit=surface.intersect(host.matrix,this.ray,this.barkHit);
   return hit?(hit.x-host.x)*n.x+(hit.z-host.z)*n.z:NaN;
  };
  for (const angle of lanternAngles(this.seed, host)) {
   const barkSite = yield* buildLanternBarkSite(host, (x, z) => this.sample(x, z), depth, this.seed, angle);
   const site = barkSite && (yield* buildLanternHollowSite(barkSite, (x,z)=>this.sample(x,z)));
   if (!site) continue;
   let valid = true;
   for (let i = 0; i <= 12 && valid; i++) {
    const p = site.point({ x: 0, y: 0.8, z: 3.6 + i / 12 * 3.4 });
    valid = lanternHabitat(this.sample(p.x, p.z)) && !this.shared.colliders.some(c =>
     Math.hypot(c.position.x - host.x, c.position.z - host.z) > 0.1
     && Math.hypot(c.position.x - p.x, c.position.z - p.z) < c.radius + 2); yield;
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
 add(site, prepared=null) {
  if (this.colonies.has(site.id)) return this.colonies.get(site.id);
  const colony = prepared || new LanternMiteColony(site);
  if(!prepared){
  colony.meshes = new LanternMiteMeshes(this.root); colony.born = this.time;
  colony.home = new LanternMiteHomeMeshes(this.root,site,colony.model.mites,this.homeMaterials);
  colony.paths=new LanternMitePaths(colony.home,site);
  }
  this.root.add(colony.meshes.root,colony.home.root);colony.born=this.time;
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
 stream() { this.streamWork ||= this.buildStream(); }
 async prewarm() {
  this.materialWarmup ||= await warmLanternMaterials(this.scene,this.shared,this.homeMaterials);
 }
 drainStream() {
  if(!this.streamWork||this.streamWaiting)return;
  const deadline=performance.now()+1.5;
  while(this.streamWork&&performance.now()<deadline){
   const started=performance.now(),result=this.streamWork.next();
   const ms=performance.now()-started;
   if(ms>this.streamStats.maxStepMs){this.streamStats.maxStepMs=ms;this.streamStats.longestStage=this.streamStage;}
   this.streamStats.byStage ||= {};const stats=this.streamStats.byStage[this.streamStage||'stream'] ||= {steps:0,ms:0,max:0};stats.steps++;stats.ms+=ms;stats.max=Math.max(stats.max,ms);this.streamStats.steps++;
   if(result.done){this.streamWork=null;break;}
   if(result.value?.then){
    const work=this.streamWork;this.streamWaiting=true;
    result.value.then(()=>{if(this.streamWork===work)this.streamWaiting=false;},error=>{
     if(this.streamWork!==work)return;work.return();this.streamWork=null;this.streamWaiting=false;this.streamError=String(error);
    });break;
   }
  }
 }
 *prepareColony(site) {
  const colony=new LanternMiteColony(site),staging=new THREE.Group();let installed=false;
  try{
   this.streamStage='geometry';
   colony.home=new LanternMiteHomeMeshes(staging,site,colony.model.mites,this.homeMaterials,true);
   yield* colony.home.work;
   this.streamStage='paths';
   colony.paths=new LanternMitePaths(colony.home,site,true);yield* colony.paths.work;
   this.streamStage='mites';
   colony.meshes=new LanternMiteMeshes(staging);
   colony.meshes.update(colony.model.mites,colony.model.time,m=>colony.position(m),site.scale,0);
   yield;
   const renderer=this.shared.renderer,camera=this.shared.camera;
   if(renderer){
    // Compile against the live light layout before the home becomes visible.
    const warm=new THREE.Scene();warm.environment=this.scene.environment;warm.environmentIntensity=this.scene.environmentIntensity;warm.fog=this.scene.fog;warm.add(staging);
    this.scene.traverseVisible(light=>{if(!light.isLight||!light.layers.test(camera.layers))return;const copy=light.clone();copy.position.setFromMatrixPosition(light.matrixWorld);warm.add(copy);});
    this.warmTarget ||= new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType});
    this.streamStage='compile';
    if(renderer.compileAsync){
     const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();let ready;
     // Composer scene passes render into a linear target. Compiling against
     // the screen instead creates different tone-mapping/color-space programs
     // and leaves the first real draw to compile synchronously again.
     try{renderer.setRenderTarget(this.warmTarget);ready=renderer.compileAsync(warm,camera);}
     finally{renderer.setRenderTarget(target,face,mip);}
     yield ready;
    }
    yield;
    this.streamStage='upload';
    const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
    const culling=[];staging.traverse(mesh=>{if(mesh.isMesh||mesh.isSprite){culling.push([mesh,mesh.frustumCulled]);mesh.frustumCulled=false;}});
    try{renderer.setRenderTarget(this.warmTarget);renderer.render(warm,camera);}
    finally{renderer.setRenderTarget(target,face,mip);for(const[mesh,value]of culling)mesh.frustumCulled=value;}
    yield;
   }
   if(this.shared.audio){this.audio ||= new LanternMiteAudio(this.shared.audio,3);this.streamStage='audio';yield this.audio.prepare(colony.model.mites);}
   const p=this.shared.player.position;
   if(this.colonies.size>=CAP||this.colonies.has(site.id)||!this.hosts().includes(site.host)||Math.hypot(site.host.x-p.x,site.host.z-p.z)>RANGE*1.4)return;
   this.streamStage='install';
   this.add(site,colony);installed=true;this.streamStats.installed++;
  }finally{
   if(!installed){colony.home?.dispose();colony.meshes?.dispose();colony.paths?.work.return();this.streamStats.cancelled++;}
  }
 }
 *buildStream() {
  const p = this.shared.player.position, hosts = this.hosts(), live = new Set(hosts);
  for (const colony of this.colonies.values()) {
   if (!live.has(colony.site.host) || Math.hypot(colony.site.center.x - p.x, colony.site.center.z - p.z) > RANGE * 1.4) {
    this.remove(colony); if (this.selected === colony) this.selected = null;
   } else colony.home.clearGrass(this.vegetation);
   yield;
  }
  let attempts = 0;
  for (const host of hosts.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))) {
   if (this.colonies.size >= CAP || attempts >= 3) break;
   if (this.colonies.has(host.id) || this.rejected.has(host) || Math.hypot(host.x - p.x, host.z - p.z) > RANGE) continue;
   if ([...this.colonies.values()].some(c => Math.hypot(c.site.host.x - host.x, c.site.host.z - host.z) < 85)) continue;
   attempts++; const site = yield* this.buildSite(host); if (site) yield* this.prepareColony(site);
  }
 }
 visit(current = null) {
  const loaded = [...this.colonies.values()], index = loaded.indexOf(current);
  const existing = current ? loaded.find(c=>c!==current&&!this.visited.has(c.id)) : loaded[0];
  let colony = existing;
  // Visits use complete homes from the same staged builder as exploration.
  // Building paths and uploading a new home inside the click handler hitches
  // even on the development Mac. The guide already retries while forests load.
  if (!colony) this.stream();
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
 prepareAudio() {
  this.audio ||= new LanternMiteAudio(this.shared.audio,3);
  return Promise.all([...this.colonies.values()].map(colony=>this.audio.prepare(colony.model.mites)));
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
  this.drainStream();
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
  this.materialWarmup?.dispose();
  this.streamWork?.return();this.streamWork=null;this.warmTarget?.dispose();
  this.audio?.dispose(); for (const c of [...this.colonies.values()]) this.remove(c);
  this.barkMaterial.dispose(); this.root.removeFromParent(); document.removeEventListener('visibilitychange', this.onVisibility);
 }
}
