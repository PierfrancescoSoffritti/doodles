import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){
 if(specifier==='three')return {url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('three/addons/'))return {url:new URL('../../../common/libs/three-0.185/examples/jsm/'+specifier.slice(13),import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const THREE=await import('three');
const {WorldPlants,PLANT_CAPS}=await import('../../js/world/WorldPlants.js');
const {plantSites,plantFooting}=await import('../../js/world/PlantHabitats.js');
const {bus,Events}=await import('../../js/core/EventBus.js');
const {REPLY_MASK_LAYER}=await import('../../js/world/fauna/ReplyOutline.js?v=pendant-feedback-1');
const {pickTarget,hoverTarget,dispatchPress}=await import('../../js/landmarks/TargetPicking.js');
const sample=(x,z)=>({ground:2,water:0,slope:.04,foam:0,wet:.7,coast:.1,roof:false});
const lakes=[{id:0,shore:Array.from({length:20},(_,i)=>({x:i*90,z:0,nx:0,nz:1,y:0}))}];
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,13,24);
 const shared={world:{rivers:[]},camera,player:{position:camera.position},colliders:[],surfaceStreaming:true};
 const hm={sample(x,z){this._water=0;this._slope=.04;return 2;},habitat:()=>({wet:.7,coast:.1}),caves:{hasOpening:()=>false,surfaceDensity:()=>-10}};
 const plants=new WorldPlants(scene,hm,shared,lakes,'plants-test');return {scene,shared,plants};
}
test('plant sites are deterministic, spaced, dry-rooted and reject steep or buried banks',()=>{
 const sites=plantSites({rivers:[]},lakes,sample,'plants-test');assert.deepEqual(sites,plantSites({rivers:[]},lakes,sample,'plants-test'));
 for(const species of Object.keys(PLANT_CAPS)){
  const members=sites.filter(s=>s.species===species);assert.ok(members.length>0);
  assert.deepEqual(new Set(members.flatMap(s=>[s.form,...(s.companions||[]).map(c=>c.form)])),new Set(species==='bell-reed'?['young','mature','weathered']:['ribbons','sprays','veils']));
  for(const patch of [{roof:true},{slope:.8},{ground:-3},{foam:.7}])assert.equal(plantFooting(species,{...sample(),...patch},0),false);
  for(const a of members)for(const b of members)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=(species==='bell-reed'?7:60));
 }
});
test('world plants stream within species caps and release batches, mirrors and colliders',()=>{
 const {plants,shared,scene}=fixture();let built=0;
 for(let x=0;x<1800;x+=180){
  shared.player.position.x=x;plants.stream(true);plants.update(0);plants.update(.05);
  for(const species of Object.keys(PLANT_CAPS))assert.ok([...plants.entries.values()].filter(e=>e.site.species===species).length<=PLANT_CAPS[species]);
  for(const e of plants.entries.values()){
   built++;assert.equal(e.root.position.y,e.site.y);assert.ok(e.root.scale.x>0,'a newly streamed reflector never has a singular world matrix');
   for(const {mesh} of e.batch.batches)for(const attr of Object.values(mesh.geometry.attributes))assert.ok(attr.array.every(Number.isFinite));
   assert.ok(e.batch.batches.length<e.rig.root.getObjectsByProperty('isMesh',true).length,'world batches reduce draw calls');
  }
 }
 assert.ok(built>10);plants.dispose();assert.equal(scene.children.length,0);assert.equal(shared.colliders.length,0);
});
test('only nearby player notes earn replies, and real player proximity bends stems',()=>{
 const {plants,shared}=fixture();plants.stream(true);plants.update(.05);
 const entry=[...plants.entries.values()].find(e=>e.site.species==='bell-reed');assert.ok(entry);
 const p=shared.player.position;p.set(entry.site.x,entry.site.y+11,entry.site.z);
 plants.hearNote({layer:'plant-reply',position:p,radius:90,velocity:1});assert.equal(entry.model.pending.length,0);
 plants.hearNote({layer:'player-note',position:{x:9999,y:13,z:9999},radius:90,velocity:1});assert.equal(entry.model.pending.length,0);
 plants.hearNote({layer:'player-note',position:p,radius:90,velocity:1});assert.ok(entry.model.pending.length>0);
 const pending=entry.model.pending.length;plants.hearNote({layer:'player-note',position:p,radius:90,velocity:1});assert.equal(entry.model.pending.length,pending);
 assert.ok(entry.model.brushBend(entry.model.plants[0])>.2);p.x+=30;assert.ok(entry.model.brushBend(entry.model.plants[0])<.001);
 plants.dispose();
});

test('each reed patch keeps at least two smaller companions on individually sampled terrain',()=>{
 const {plants}=fixture();plants.stream(true);
 for(const site of plants.sites.filter(s=>s.species==='bell-reed')){
  assert.ok(site.companions.length>=2&&site.companions.length<=3);
  for(const c of site.companions){assert.ok(c.scale<site.scale*.83);assert.ok(Math.hypot(c.x-site.x,c.z-site.z)<8);assert.equal(c.y,sample(c.x,c.z).ground);}
 }
 for(const entry of plants.entries.values())if(entry.site.species==='bell-reed'){
  assert.equal(entry.model.plants.length,entry.site.companions.length+1);
  entry.model.plants.slice(1).forEach((p,i)=>assert.ok(Math.abs(entry.site.y+p.y*entry.site.scale-entry.site.companions[i].y)<1e-8));
 }
 plants.dispose();
});

test('rapid blips retrigger sound and light at full range even when all six voices are busy',()=>{
 const {plants,shared}=fixture();plants.stream(true);const entry=[...plants.entries.values()].find(e=>e.site.species==='bell-reed');
 const p=shared.player.position;p.set(entry.site.x+140,entry.site.y+11,entry.site.z);
 const sounds=[],stopped=[];
 shared.audio={ctx:{state:'running'},now:0,playBell:options=>{sounds.push(options);const id=sounds.length;return {stop:()=>stopped.push(id)};}};
 shared.conductor={scale:{freq:()=>440}};
 for(let i=0;i<12;i++){
  plants.hearNote({layer:'player-note',position:p,velocity:1,radius:165});
  entry.model.update(.2);
  const events=entry.model.drainEvents().filter(e=>e.kind==='reed');
  assert.ok(events.length>0);assert.ok(entry.model.pending.length<=8);
  assert.ok(entry.model.plants[0].stems[0].energy>0);
  const before=sounds.length;for(const event of events)plants.play(entry,event);
  assert.equal(sounds.length,before+events.length,'new sound is never dropped at the voice limit');
  assert.ok(plants.voices.length<=6);
 }
 assert.ok(stopped.length>0,'old tails fade out when the voice limit is reached');
 assert.ok(sounds.every(s=>s.layer==='plant-reply'));
 plants.dispose();assert.equal(plants.voices.length,0);
});

test('pendants use stable gaze targets, enlarge the reticle, and play the existing mirror sound on every click',()=>{
 const {plants,shared}=fixture(),site=plants.sites.find(s=>s.species==='veil-willow');site.pendants=true;
 const entry=plants.add(site),item=entry.pendants[0],camera=shared.camera,point=item.mesh.getWorldPosition(new THREE.Vector3());
 camera.position.copy(point).add(new THREE.Vector3(0,0,40));camera.lookAt(point);camera.updateMatrixWorld(true);
 const raycaster=new THREE.Raycaster();raycaster.far=140;
 const hit=pickTarget(raycaster,camera,camera.position,plants.pendants.map(p=>p.target));assert.equal(hit,item.target);
 camera.lookAt(point.clone().add(new THREE.Vector3(12,0,0)));camera.updateMatrixWorld(true);
 const screen=point.clone().project(camera);
 assert.equal(pickTarget(raycaster,camera,camera.position,plants.pendants.map(p=>p.target),new THREE.Vector2(screen.x,screen.y)),item.target,'free cursor picks an off-center pendant');
 camera.lookAt(point);camera.updateMatrixWorld(true);
 const hovers=[];const hud={setHover:on=>hovers.push(on)};
 let hovered=hoverTarget(null,hit,hud);assert.equal(item.mirror.hovered,true);
 hovered=hoverTarget(hovered,pickTarget(raycaster,camera,camera.position,plants.pendants.map(p=>p.target)),hud);assert.deepEqual(hovers,[true]);
 const ripples=[],off=bus.on(Events.RIPPLE,event=>ripples.push(event));
 const sounds=[];shared.conductor={mirrorTouch:(at,layer)=>{assert.equal(layer,'pendant');sounds.push(at.clone());}};
 hit.onPress(0);hit.onPress(1);assert.equal(sounds.length,2);assert.ok(sounds.every(at=>at.distanceTo(point)<1e-8));
 assert.equal(ripples.length,2);assert.ok(ripples.every(r=>r.x===site.x&&r.z===site.z),'ground rings start at the tree base');off();
 assert.equal(item.reply.outline.parent,item.mesh);assert.ok(item.reply.outline.layers.isEnabled(REPLY_MASK_LAYER));
 assert.ok(entry.batch.batches.every(b=>!b.parts.includes(item.reply.outline)),'outline stays in the mask pass, outside world batches');
 plants.update(.12);assert.equal(plants.hasReplyHighlights,true);assert.ok(item.reply.signal.value>0);assert.ok(item.reply.echo.value.x>0);
 assert.equal(entry.pendants[1].reply.signal.value,0,'only the clicked pendant has an outline');
 const before=item.mirror.pivot.rotation.z;hit.onPress(0);entry.rig.update(camera);assert.equal(item.mirror.pivot.rotation.z,before,'reclick does not snap the rendered swing');
 plants.update(4);assert.equal(plants.hasReplyHighlights,false);assert.equal(item.reply.signal.value,0,'outline fades away');
 assert.equal(entry.model.drainEvents().filter(e=>e.kind==='mirror').length,0,'no extra atelier bell is layered over the mirror sound');
 hoverTarget(hovered,null,hud);assert.deepEqual(hovers,[true,false]);
 plants.remove(entry);hit.onPress(0);assert.equal(sounds.length,3,'retired targets cannot be played');plants.dispose();
});

test('retiring a willow releases each owned buffer, material and reflection target once',()=>{
 const {plants}=fixture(),site=plants.sites.find(s=>s.species==='veil-willow');site.pendants=true;
 const entry=plants.add(site),resources=new Set();entry.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
 for(const m of entry.rig.mirrors){resources.add(m.reflectionMaterial);resources.add(m.reflector.getRenderTarget());}
 const disposed=new Map();for(const r of resources)r.addEventListener('dispose',()=>disposed.set(r,(disposed.get(r)||0)+1));
 plants.remove(entry);for(const r of resources)assert.equal(disposed.get(r),1);
 plants.dispose();
});


test('a target click never also emits a player blip, including a moving pendant caught by hover',()=>{
 const touches=[],notes=[],target={onPress:charge=>touches.push(charge)},playerNotes={send:charge=>notes.push(charge)};
 let aims=0;
 dispatchPress({aim:()=>{aims++;return target;},hovered:null},playerNotes,.1);
 assert.equal(aims,1);assert.deepEqual(touches,[0]);assert.deepEqual(notes,[]);
 dispatchPress({aim:()=>null,hovered:target},playerNotes,2);
 assert.deepEqual(touches,[0,1]);assert.deepEqual(notes,[]);
 dispatchPress({aim:()=>null,hovered:null},playerNotes,.83);
 assert.equal(notes.length,1);assert.ok(Math.abs(notes[0]-.5)<1e-10);
});
