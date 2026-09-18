import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return {url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};if(s.startsWith('three/addons/'))return {url:new URL('../../../common/libs/three-0.185/examples/jsm/'+s.slice(13),import.meta.url).href,shortCircuit:true};return next(s,c);}});
globalThis.location={search:'?seed=water-test'};globalThis.matchMedia=()=>({matches:false});
const THREE=await import('three');
const {WorldWaterLife}=await import('../../js/world/WorldWaterLife.js');
function fixture(small=false){
 const world={rivers:[]},hm={world,waterLevel:0,sample(){this._water=10;this._foam=0;this._riverSeg=-1;return 7;}};
 const shared={world,mirrorHide:new Set(),player:{position:new THREE.Vector3(0,20,0)},terrainUniforms:{uTime:{value:0}}};
 const lakes=[{id:0,shore:Array.from({length:30},(_,i)=>({x:i*60,z:0,y:10,nx:0,nz:1}))}];
 const scene=new THREE.Scene(),life=new WorldWaterLife(scene,hm,shared,lakes,'water-test',{small});
 return {shared,scene,life};
}
test('world population is bounded, batched, submerged and disposed on travel',()=>{
 for(const small of [false,true]){
  const {life,shared,scene}=fixture(small);life.stream(true);life.update(1);scene.updateMatrixWorld(true);
  assert.ok(life.entries.size);assert.ok(life.entries.size<=(small?8:12));
  for(const e of life.entries.values()){
   assert.ok(e.lilies.batches.length<=3);
   e.root.traverse(o=>{assert.ok(!o.isLight);if(o.isMesh&&o.visible){assert.equal(o.castShadow,false);assert.equal(o.receiveShadow,false);assert.ok(o.isInstancedMesh);for(const a of Object.values(o.geometry.attributes))assert.ok(a.array.every(Number.isFinite));}});
   for(const b of e.lilies.batches){
    assert.ok(shared.mirrorHide.has(b.mesh),'inland lilies are excluded from the sea-level mirror');
    const box=new THREE.Box3().setFromObject(b.mesh);assert.ok(box.min.y>=e.site.y,'no underwater stalks');if(b.kind!=='cores')assert.ok(box.min.y<e.site.y+.08,'flower cups and pads rest on the water');
   }
  }
  const resources=[];for(const e of life.entries.values()){if(e.fish.mesh)resources.push(e.fish.geometry,e.fish.material,e.fish.mesh);for(const {mesh} of e.lilies.batches)resources.push(mesh.geometry,mesh.material,mesh);}
  let disposed=0;resources.forEach(r=>r.addEventListener('dispose',()=>disposed++));
  shared.player.position.set(100000,20,0);life.stream(true);assert.equal(life.entries.size,0);assert.equal(disposed,resources.length);assert.equal(shared.mirrorHide.size,0);
  life.dispose();assert.equal(scene.children.length,0);
 }
});

function lilyRoute(life,count=30){
 const template=life.sites.find(s=>s.plants.some(p=>p.bloom));
 life.sites=Array.from({length:count},(_,i)=>{
  const x=i*70;
  return {...template,id:`route:${i}`,x,z:0,groups:[],plants:template.plants.map(p=>({...p,x:x+p.x-template.x,z:p.z-template.z}))};
 });
}

test('lilies are fully visible well ahead throughout a sprint, including on mobile',()=>{
 for(const small of [false,true])for(const fps of [30,60]){
  const {life,shared}=fixture(small);lilyRoute(life);
  shared.player.position.x=-600;shared.player.velocity=new THREE.Vector3(80,0,0);
  let checked=0;
  for(let frame=0;frame<fps*22;frame++){
   shared.player.position.x+=80/fps;life.update(1/fps);
   assert.ok(life.entries.size<=life.cap);
   for(const site of life.sites){
    const ahead=site.x-shared.player.position.x;if(ahead<180||ahead>240)continue;
    const e=life.entries.get(site.id);
    assert.ok(e,`patch ${site.id} is loaded ${ahead.toFixed(0)} units ahead`);
    assert.ok(e.root.visible);assert.equal(e.fade,1);
    for(const b of e.lilies.batches)assert.equal(b.mesh.material.opacity,1);
    checked++;
   }
  }
  assert.ok(checked>100);life.dispose();
 }
});

test('closer upcoming patches replace distant residents and queued patches load next frame',()=>{
 for(const small of [false,true]){
  const {life,shared}=fixture(small);lilyRoute(life);
  shared.player.position.x=350;life.stream(true);assert.equal(life.entries.size,life.cap);
  shared.player.position.x=490;shared.player.velocity=new THREE.Vector3(80,0,0);
  // Occupy every slot with old patches behind the player.
  for(const e of life.entries.values())life.remove(e);
  const old=life.sites.slice(0,life.cap).map((s,i)=>({...s,id:`old:${i}`,x:200-i*10}));
  life.sites.unshift(...old);old.forEach(s=>life.add(s));
  const upcoming=life.sites.find(s=>s.id==='route:8');
  for(let i=0;i<3;i++)life.update(1/60);
  assert.ok(life.entries.has(upcoming.id),'residents do not pin the whole budget');
  const size=life.entries.size;life.update(1/60);
  assert.equal(life.entries.size,size+1,'backlog drains without a polling delay');
  life.focus=old.at(-1);life.stream(true);
  assert.ok(life.entries.has(life.focus.id),'field-guide focus remains resident');
  assert.ok(life.entries.size<=life.cap);life.dispose();
 }
});

test('deep fish escape routes reject shelves shallower than their entire dive range',()=>{
 const {life}=fixture();
 const site={id:'deep-test',x:0,z:0,y:10,radius:45,plants:[],groups:[{x:0,z:0,count:13,radius:18,depth:20,speed:.2,direction:1,phase:0,aspect:.8,turn:0}]};
 let probes=0;
 life.sample=(x,z)=>{probes++;return {ground:Math.abs(x)>30?-3:-10,water:10,foam:0,speed:0,roof:false};};
 const e=life.add(site),deep=e.model.fish.at(-1);
 assert.ok(deep.maxDepth+deep.size*.4>13);
 assert.equal(e.model.canSwim(0,0,deep),true);
 assert.equal(e.model.canSwim(40,0,deep),false,'shelf cannot fit the complete dive');
 const before=probes;e.model.update(3);e.model.update(6);assert.equal(probes,before,'cruising requires no terrain probes');
 e.model.hear(0,0,200);
 assert.ok(e.model.fish.some(f=>f.escape));
 for(const f of e.model.fish){
  const b=f.escape;if(!b)continue;
  for(let t=0;t<b.duration+b.returnDuration;t+=.025){
   const p=e.model.swimPose(f,b.at+t),y=site.y+e.model.swimY(f,b.at+t),half=f.size*(.8+.2*f.bodyWidth)*.4;
   assert.ok(y-half>life.sample(p.x,p.z).ground+.2);
   assert.ok(y+half<site.y-.2);
  }
 }
 life.dispose();
});
test('only nearby surface lilies hear player notes; hiding in caves suspends resident updates',()=>{
 const {life,shared}=fixture();life.stream(true);life.update(1);
 const e=[...life.entries.values()].find(e=>e.model.plants.some(p=>p.bloom));assert.ok(e);
 const note={layer:'player-note',position:{x:e.site.x,y:e.site.y+11,z:e.site.z},radius:100};
 life.hearNote({...note,layer:'plant-reply'});assert.ok(e.model.plants.every(p=>p.replyAt===-100));assert.ok(e.model.fish.every(f=>!f.escape));
 life.hearNote(note);assert.ok(e.model.fish.every(f=>f.escape));life.update(.5);assert.ok(e.model.plants.some(p=>p.glow>.1));
 const t=e.model.time;shared.caveAmount=1;life.update(1);assert.equal(life.root.visible,false);assert.equal(e.model.time,t);
 life.dispose();
});

test('flowers are pickable targets; tap and hold use the player-note path and bounded size-based voices',()=>{
 const {life,shared,scene}=fixture();life.stream(true);life.update(1);scene.updateMatrixWorld(true);
 const e=[...life.entries.values()].find(e=>e.targets.length),target=e.targets[0],sent=[];
 shared.playerNotes={send:(charge,replyTarget)=>sent.push({charge,replyTarget})};
 target.onPress(.9);assert.equal(sent.length,1);assert.equal(sent[0].replyTarget.waterSite,e.site.id);assert.equal(sent[0].charge,.9);
 const bells=[],stops=[];shared.audio={ctx:{state:'running'},now:1,playerBus:{},playBell:options=>{bells.push(options);return {stop:()=>stops.push(1)};}};shared.conductor={scale:{freq:(degree,octave)=>100+degree*10+octave}};
 shared.player.position.set(e.site.x,e.site.y+11,e.site.z);
 life.hearNote({layer:'player-note',position:shared.player.position,velocity:.95,radius:200,replyTarget:sent[0].replyTarget});life.update(.13);
 assert.ok(e.model.plants.filter(p=>p.bloom).every(p=>p.glow>.7));assert.ok(bells.length>0);assert.ok(bells.every(b=>b.layer==='plant-reply'));
 for(let i=0;i<12;i++){life.hearNote({layer:'player-note',position:shared.player.position,velocity:.95,radius:200});life.update(.17);}
 assert.ok(life.voices.length<=6);assert.ok(stops.length);life.dispose();
});


test('cupped lily flowers enclose luminous cores from every horizontal side',()=>{
 const {life,scene}=fixture();life.stream(true);scene.updateMatrixWorld(true);
 for(const e of life.entries.values()){
  const flower=e.lilies.batches.find(b=>b.kind==='flowers'),core=e.lilies.batches.find(b=>b.kind==='cores');if(!flower)continue;
  const matrix=new THREE.Matrix4(),center=new THREE.Vector3(),ray=new THREE.Raycaster();
  for(let i=0;i<flower.list.length;i++){
   const p=flower.list[i].plant;core.mesh.getMatrixAt(i,matrix);matrix.premultiply(core.mesh.matrixWorld);
   center.set(0,.13,0).applyMatrix4(matrix);
   flower.mesh.geometry.computeBoundingBox();assert.ok(flower.mesh.geometry.boundingBox.max.y*(p.flowerHeight??.85)>.19&&flower.mesh.geometry.boundingBox.max.y*(p.flowerHeight??.85)<.65,'varied flower heights retain a bounded profile');
   for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12){
    const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));ray.set(center.clone().addScaledVector(direction,p.size*3),direction.negate());
    const petals=ray.intersectObject(flower.mesh).filter(h=>h.instanceId===i),cores=ray.intersectObject(core.mesh).filter(h=>h.instanceId===i);
    assert.ok(cores.length);assert.ok(petals.length&&petals[0].distance<cores[0].distance,'opaque bowl blocks direct view of core');
   }
  }
 }
 life.dispose();
});
