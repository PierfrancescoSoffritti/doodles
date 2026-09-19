import { mountainApproach } from './world/structures/MountainSteps.js?v=structures-place-4';
import { altarFloor } from './world/structures/SummitSite.js?v=structures-place-4';
import { agedStoneMaterial } from './world/structures/AgedStone.js?v=structures-place-4';
import { facetedPart, wornPart, altarPieces } from './world/structures/StructureGeometry.js?v=structures-place-4';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mountAtelierNavigation, ATELIER_STRUCTURES } from './atelier/AtelierCatalog.js?v=structures-world-2';
import { StructureStudy, EYE_HEIGHT } from './atelier/StructureStudy.js?v=structures-place-4';
import { StructureAudio } from './atelier/StructureAudio.js?v=structures-place-4';
import { Random } from './core/Random.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const kind=ATELIER_STRUCTURES.some(s=>s.id===params.get('species'))?params.get('species'):'resonant-gate';
const seed=mountAtelierNavigation(kind)||'umbra',fold=kind==='listening-fold',frameOnly=kind==='horizon-frame';
$('world-link').href='./?seed='+encodeURIComponent(seed)+'&structures='+kind;
const copy={
 'resonant-gate':['Resonant gate.','An opening. A quiet answer. A view beyond.','A place to pass through.','The landscape beyond.','Two grounded uprights hold an open passage. A small seam responds when you offer a note.','Approach the gate, then sing or touch its inset. Each note receives a local answer; repeated notes build resonance.','A landscape threshold','In the game, the gate marks a ridge passage, woodland transition or the reveal of a shore or valley. Walk through to discover the view.'],
 'listening-fold':['Listening fold.','A stone pavilion for a deeper way of listening.','A place to stay a while.','The music draws closer.','Two tall folded stone wings shelter an open hall. The main drone deepens inside; each note gets a two-tone answer.','Start the game music, then step inside and outside. The same piece continues: its melody thins, its drone warms, and its balance gradually returns when you leave.','A sheltered clearing edge','The fold sits against rising ground or woodland, with an opening toward a clearing or water. Its roof shelters you from weather as the main music changes.'],
 'horizon-frame':['Horizon frame.','An unfinished circle. A landscape held within it.','A place to look through.','An opening to the distance.','A broken polygon gives the horizon a boundary. Walk around it and watch the view move through the opening.','Climb the steps, offer a note and watch a pulse travel through the frame. Repeated notes keep the stone ringing.','A mountain altar','In the game, the frame stands on a mountain summit overlooking a visible valley, with a weathered stone trail following the mountainside.']
}[kind];
for(const [i,id] of ['name','intro','form-title','character-title','character','interaction-note','home-title','home-detail'].entries())$(id).textContent=copy[i];
document.title=copy[0].replace(/\.$/,'')+' · Nowherelands atelier';
$('enter').firstChild.textContent=fold?'Step inside ':frameOnly?'Look through ':'Pass through ';

if(fold){$('offer-note').innerHTML='Offer a note <small>Listen to its tail under the fold · N</small>';$('strong-note').hidden=true;}
if(frameOnly)$('individual').hidden=true;
const fail=e=>{$('error').hidden=false;$('error').textContent=e?.message||String(e);document.body.dataset.status='fail';};
addEventListener('error',e=>fail(e.error||e.message));addEventListener('unhandledrejection',e=>fail(e.reason));
const tabs=['form','life','home'];
function tab(index){tabs.forEach((id,i)=>{$('tab-'+id).setAttribute('aria-selected',String(i===index));$('tab-'+id).tabIndex=i===index?0:-1;$('panel-'+id).hidden=i!==index;});}
tabs.forEach((id,i)=>{const b=$('tab-'+id);b.onclick=()=>tab(i);b.onkeydown=e=>{const j=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:null;if(j!==null){e.preventDefault();tab(j);$('tab-'+tabs[j]).focus();}};});

const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(47,1,.5,1800);
scene.fog=new THREE.FogExp2('#21182f',.0019);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.enablePan=false;orbit.minDistance=35;orbit.maxDistance=280;orbit.maxPolarAngle=Math.PI*.49;
const hemi=new THREE.HemisphereLight('#ded4f0','#44334f',2.1),moon=new THREE.DirectionalLight('#c4d3ff',3.2),rim=new THREE.DirectionalLight('#b65b94',1.1);
moon.position.set(-70,100,40);rim.position.set(90,50,-80);scene.add(hemi,moon,rim);
moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);Object.assign(moon.shadow.camera,{left:-95,right:95,top:95,bottom:-95,near:1,far:250});moon.shadow.normalBias=.12;
const groundMat=new THREE.MeshStandardMaterial({color:'#30243e',roughness:1,flatShading:true});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1300,1300),groundMat);ground.rotation.x=-Math.PI/2;ground.position.set(0,-.2,400);scene.add(ground);
ground.receiveShadow=true;
const waterMat=new THREE.MeshStandardMaterial({color:'#4d3c66',roughness:.45,metalness:.3});
const water=new THREE.Mesh(new THREE.PlaneGeometry(1400,700,24,18),waterMat);water.rotation.x=-Math.PI/2;water.position.set(0,-.4,-310);scene.add(water);
const rnd=new Random(seed+':structure-landscape');
const rockMat=new THREE.MeshStandardMaterial({color:'#49384f',flatShading:true,roughness:1}),mountainMat=new THREE.MeshStandardMaterial({color:'#483859',flatShading:true,roughness:1});
const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),rockMat,75),matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
for(let i=0;i<75;i++){const a=rnd.range(0,Math.PI*2),r=rnd.range(56,106),s=rnd.range(.5,2.4);matrix.compose(new THREE.Vector3(Math.cos(a)*r,s*.2,Math.sin(a)*r),q,new THREE.Vector3(s*1.8,s*.65,s));rocks.setMatrixAt(i,matrix);}scene.add(rocks);
const mountains=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),mountainMat,14);
for(let i=0;i<14;i++){const h=rnd.range(65,180);matrix.compose(new THREE.Vector3(-610+i*92,h/2-2,-500-rnd.range(0,120)),q,new THREE.Vector3(rnd.range(80,140),h,rnd.range(80,130)));mountains.setMatrixAt(i,matrix);}scene.add(mountains);
const grassMat=new THREE.MeshStandardMaterial({color:'#80738f',emissive:'#8c6da6',emissiveIntensity:.13,side:THREE.DoubleSide,flatShading:true,roughness:1});
const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.22,2,3),grassMat,380);
for(let i=0;i<380;i++){const x=rnd.range(-125,125),z=rnd.range(-85,130),s=rnd.range(.45,1.6);if(Math.abs(x)<40&&Math.abs(z)<35){matrix.makeScale(0,0,0);}else matrix.compose(new THREE.Vector3(x,s*.9,z),q,new THREE.Vector3(s,s,s));grass.setMatrixAt(i,matrix);}scene.add(grass);
const starGeo=new THREE.BufferGeometry(),starsArray=[];
for(let i=0;i<450;i++){const a=rnd.range(0,Math.PI*2),e=rnd.range(.05,1.5),r=1050;starsArray.push(Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r);}
starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starsArray,3));
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#ddd1ed',size:1.8,sizeAttenuation:true,fog:false}));scene.add(stars);
const moonMesh=new THREE.Mesh(new THREE.SphereGeometry(20,20,12),new THREE.MeshBasicMaterial({color:'#d8bfdc',fog:false}));moonMesh.position.set(230,280,-800);scene.add(moonMesh);
const stone=agedStoneMaterial();
const demoGround=(x,z)=>Math.max(0,36-.19*Math.hypot(x*.9,z)-.055*Math.max(0,z));
const altar={y:32.5,...mountainApproach(demoGround,seed)};
if(frameOnly){const g=new THREE.PlaneGeometry(420,420,42,42);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,demoGround(p.getX(i),p.getZ(i)));g.computeVertexNormals();const hill=new THREE.Mesh(g,groundMat);hill.receiveShadow=true;scene.add(hill);}
const seamMat=new THREE.MeshStandardMaterial({color:'#79c3ca',emissive:'#68e0ef',emissiveIntensity:.12,roughness:.5});
const root=new THREE.Group();scene.add(root);
const marker=new THREE.Group();const markerMat=new THREE.MeshBasicMaterial({color:'#ddd4bc'});
const pole=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,EYE_HEIGHT,6),markerMat);pole.position.y=EYE_HEIGHT/2;marker.add(pole);
const cap=new THREE.Mesh(new THREE.SphereGeometry(.6,8,6),markerMat);cap.position.y=EYE_HEIGHT;marker.add(cap);marker.position.set(-40,0,22);marker.visible=false;scene.add(marker);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.25,.4,1);composer.addPass(bloom);composer.addPass(new OutputPass());
const audio=new StructureAudio();let model,serial=1,seam,paused=false,disposed=false,walking=false,yaw=0,pitch=0,last=performance.now(),pointer=null,noteStart=null;
const keys=new Set(),moves=new Set();
function resetForm(){
 audio.stop();musicLabel();for(const child of [...root.children]){root.remove(child);child.geometry.dispose();}
 model=new StructureStudy({kind,seed,serial});stone.userData.pulses.value=model.pulseAges;
 for(const [i,part] of model.parts.entries()){
  const geo=wornPart(part,seed+':'+kind+':wear:'+i+':'+serial);
  const mesh=new THREE.Mesh(geo,stone);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 }
 root.position.y=frameOnly?altar.y:0;if(frameOnly)for(const geometry of altarPieces(altar))root.add(new THREE.Mesh(geometry,stone));
 seam=null;if(!fold&&!frameOnly){seam=new THREE.Mesh(new THREE.BoxGeometry(.48,5.4,.12),seamMat);seam.position.set(-20,11,5.2);root.add(seam);model.contact={x:-20,y:11,z:5.2};}
 $('specimen').textContent='Form study '+String(serial).padStart(3,'0')+' / '+(fold?'Fold':frameOnly?'Frame':'Gate');
 setView();
}
function setView(){
 walking=$('view').value==='walk';orbit.enabled=!walking;$('walk-pad').hidden=!walking;$('stage').classList.toggle('walking',walking);keys.clear();moves.clear();
 $('view-hint').textContent=walking?'Drag to look · WASD / arrows to walk':'Drag to orbit · Scroll to approach';
 if(walking){yaw=0;pitch=0;syncCamera();}else{
  const dirs={quarter:[.58,.35,1],front:[0,.13,1],side:[1,.22,.15],top:[0,1,.001]};orbit.target.set(0,fold?32:frameOnly?35:23,0);camera.position.fromArray(dirs[$('view').value]).normalize().multiplyScalar(frameOnly?205:fold?160:125).add(orbit.target);camera.rotation.order='XYZ';orbit.update();
 }
 resize();
}
function syncCamera(){camera.position.set(model.visitor.x,EYE_HEIGHT+(frameOnly?Math.max(demoGround(model.visitor.x,model.visitor.z),altarFloor(altar,model.visitor.x,model.visitor.z)):0),model.visitor.z);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);}
function lighting(){const night=$('light').value==='night';$('stage').classList.toggle('night',night);scene.background=new THREE.Color(night?'#171225':'#d5d1d6');scene.fog.color.set(night?'#30243e':'#b6adb9');groundMat.color.set(night?'#40324c':'#8e828c');waterMat.color.set(night?'#68597f':'#9795af');mountainMat.color.set(night?'#655474':'#8a7d9a');hemi.intensity=night?2.1:2.8;moon.intensity=night?3.2:3;rim.intensity=night?1.1:.65;stars.visible=moonMesh.visible=night;bloom.strength=night?.25:.06;material();}
function material(){const ceramic=$('material').value==='ceramic';stone.color.set(ceramic?'#c9bfd3':stone.userData.wear?'#62636d':'#6a5b78');stone.roughness=ceramic?.7:.96;if(stone.userData.wear)stone.userData.wear.value=ceramic?0:1;}
function musicLabel(){ $('music').innerHTML=audio.music?'Music playing <small>Enter and leave to compare the same piece</small>':'Listen with game music <small>The game’s conductor and musical layers</small>';}
function pause(value){paused=value;$('pause').textContent=value?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(value));if(value){audio.stop();musicLabel();keys.clear();moves.clear();}}
function at(z){model.visitor={x:0,z};$('view').value='walk';setView();pause(false);}
$('approach').onclick=()=>at(fold?48:frameOnly?153:29);$('enter').onclick=()=>{at(fold?8:-12);if(fold){pitch=.16;syncCamera();}};$('leave').onclick=()=>at(frameOnly?158:85);
function feedback(text){$('feedback').textContent=text;}
async function offer(charge=0){
 pause(false);
 const position=walking?model.visitor:{x:0,z:24};const accepted=model.offerNote('player',position,charge);
 feedback(accepted?(fold?'A two-tone answer fills the fold.':frameOnly?'The frame rings across the horizon.':'The stone answers. Repeated notes build resonance.'):'Move closer, then offer a note.');
 if($('sound').checked)try{await audio.note(accepted,charge,model.shelter,kind);}catch{feedback('Sound could not start. The visual study is still available.');}
}
for(const id of ['quick-note','offer-note'])$(id).onclick=()=>void offer();$('strong-note').onclick=()=>void offer(1);
$('music').onclick=async()=>{pause(false);$('sound').checked=true;try{await audio.startMusic();musicLabel();feedback(fold?'Walk under the fold: the main music changes continuously with your position.':'Listening to the game music.');}catch{audio.stop();musicLabel();feedback('Music could not start in this browser.');}};
$('sound').onchange=()=>{if(!$('sound').checked){audio.stop();musicLabel();}};
$('stop-audio').onclick=()=>{audio.stop();musicLabel();$('sound').checked=false;feedback('All sound stopped.');};$('volume').oninput=()=>audio.setVolume(Number($('volume').value)/100);
$('view').onchange=setView;$('reset-view').onclick=()=>{model.visitor={x:0,z:68};setView();};$('material').onchange=material;$('light').onchange=lighting;$('individual').onclick=()=>{serial++;resetForm();};$('scale-marker').onchange=()=>marker.visible=$('scale-marker').checked;$('pause').onclick=()=>pause(!paused);
const movementKeys=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'];
function textInput(e){return e.target.isContentEditable||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName);}
addEventListener('keydown',e=>{
 if(textInput(e)||e.metaKey||e.ctrlKey||e.altKey)return;
 if(e.code==='KeyN'&&!e.repeat){e.preventDefault();noteStart=performance.now();}
 if(walking&&movementKeys.includes(e.code)){e.preventDefault();keys.add(e.code);}
});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyN'&&noteStart!==null){const charge=Math.max(0,Math.min(1,(performance.now()-noteStart-280)/1100));noteStart=null;if(!document.hidden)void offer(charge);}});
const raycaster=new THREE.Raycaster();
$('canvas').addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0){pointer=null;return;}pointer={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,time:performance.now(),moved:false};if(walking)$('canvas').setPointerCapture(e.pointerId);});
$('canvas').addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>6)pointer.moved=true;if(walking){yaw-=(e.clientX-pointer.lastX)*.004;pitch=Math.max(-1.15,Math.min(1.15,pitch-(e.clientY-pointer.lastY)*.004));syncCamera();}pointer.lastX=e.clientX;pointer.lastY=e.clientY;});
$('canvas').addEventListener('pointercancel',()=>pointer=null);
$('canvas').addEventListener('pointerup',e=>{
 if(!pointer||pointer.id!==e.pointerId)return;const p=pointer;pointer=null;if(p.moved)return;
 const r=$('canvas').getBoundingClientRect();camera.updateMatrixWorld();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
 const hit=raycaster.intersectObjects(root.children,false)[0];
 // Solid surfaces occlude the inset; orbit dragging never plays a note.
 if(hit?.object===seam||!seam||!hit)void offer(Math.max(0,Math.min(1,(performance.now()-p.time-280)/1100)));
});
for(const button of document.querySelectorAll('[data-move]')){
 button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);moves.add(button.dataset.move);};
 button.onpointerup=button.onpointercancel=()=>moves.delete(button.dataset.move);
 button.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();moves.add(button.dataset.move);}};button.onkeyup=()=>moves.delete(button.dataset.move);button.onblur=()=>moves.delete(button.dataset.move);
}
function clearInput(){keys.clear();moves.clear();noteStart=null;pointer=null;audio.stop();musicLabel();last=performance.now();}
addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
function resize(){const w=$('stage').clientWidth,h=$('stage').clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.zoom=walking?1:Math.min(1,camera.aspect*1.05);camera.updateProjectionMatrix();}
const observer=new ResizeObserver(resize);observer.observe($('stage'));
resetForm();lighting();resize();pause(matchMedia('(prefers-reduced-motion: reduce)').matches);
window.__structureStudy={get model(){return model;},get paused(){return paused;},audio,renderer,scene,camera,root};
function render(now){
 if(disposed)return;const dt=Math.min((now-last)/1000,.05);last=now;
 if(!paused&&!document.hidden){
  if(walking){
   let forward=Number(keys.has('KeyW')||keys.has('ArrowUp')||moves.has('forward'))-Number(keys.has('KeyS')||keys.has('ArrowDown')||moves.has('back'));
   let right=Number(keys.has('KeyD')||keys.has('ArrowRight')||moves.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||moves.has('left'));
   const l=Math.hypot(forward,right);if(l){forward/=l;right/=l;model.move((right*Math.cos(yaw)-forward*Math.sin(yaw))*24*dt,(-forward*Math.cos(yaw)-right*Math.sin(yaw))*24*dt);syncCamera();}
  }
  model.update(dt);audio.update(dt,model);
 }
 stone.userData.response.value.set(model.flash,model.energy,model.pulseCount);
 if(seam)seamMat.emissiveIntensity=.12+model.flash*2.4+model.energy*.45;
 if(!walking)orbit.update();composer.render();
 const status=paused?'Paused':fold?(model.shelter>.65?(audio.music?'Under the fold · the music draws inward':'Under the fold · start music to listen'):model.shelter>.08?'At the threshold':'Outside · the open landscape mix'):model.flash>.08?'The stone answers. Keep playing to build resonance.':walking?'Explore the opening at player height.':'Drag to explore the form.';
 if($('gesture-status').textContent!==status)$('gesture-status').textContent=status;
 document.body.dataset.study=JSON.stringify({kind,serial,walking,paused,shelter:model.shelter,responses:model.responses,music:audio.music,geometries:renderer.info.memory.geometries});requestAnimationFrame(render);
}
addEventListener('pagehide',e=>{clearInput();if(e.persisted)return;disposed=true;observer.disconnect();orbit.dispose();composer.dispose();const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();});
document.body.dataset.status='ready';requestAnimationFrame(render);
