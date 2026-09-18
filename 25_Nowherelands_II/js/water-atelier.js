import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ATELIER_WATER, mountAtelierNavigation } from './atelier/AtelierCatalog.js?v=water-2';
import { WaterStudy } from './atelier/WaterStudy.js?v=3';
import { WaterMeshes } from './atelier/WaterMeshes.js?v=3';
import { VegetationAudio } from './atelier/VegetationAudio.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const species=ATELIER_WATER.some(s=>s.id===params.get('species'))?params.get('species'):'pool';
const seed=mountAtelierNavigation(species)||'stillwater';
const titles={pool:['The living pool.','Life above and below the surface.','A pool that answers.'],
 'scarlet-fish':['Scarlet fish.','A little red beneath the water.','Alone, or together.'],
 'light-lily':['Light lilies.','An answer on the surface.','A flower catching light.']};
const copy={pool:'A small ecosystem to try together. Scarlet fish swim beneath floating leaves and flowers.',
 'scarlet-fish':'Bright vermilion bodies, small fin beats and quiet coasting. Compare a solitary cruiser with schools of different sizes.',
 'light-lily':'Broad floating leaves and ivory flowers resting on the water. A gentle ripple wakes a warm answer between the petals.'};
const [name,caption,title]=titles[species];$('name').textContent=name;$('form-title').textContent=caption;$('character-title').textContent=title;$('character').textContent=copy[species];
if(species!=='pool')$('intro').textContent=caption;document.title=name.slice(0,-1)+' · Water atelier';
$('school-field').hidden=species==='light-lily';
if(species==='scarlet-fish'){
 $('touch').hidden=$('splash').hidden=$('water-interactions').hidden=true;
 $('tab-life').textContent='02 Behavior';
 $('interaction-note').textContent='Fish follow their own quiet routes, alone or in schools. They do not react to taps, splashes or the player.';
 $('canvas').setAttribute('aria-label','Scarlet fish study. Drag to orbit. Scroll or pinch to approach.');
}
if(['solo','small','medium','large','mixed'].includes(params.get('school')))$('school').value=params.get('school');
if(species==='scarlet-fish'&&!params.has('school'))$('school').value='small';
const fail=e=>{$('error').hidden=false;$('error').textContent=e.message||String(e);document.body.dataset.status='fail';};
addEventListener('error',e=>fail(e.error||e.message));addEventListener('unhandledrejection',e=>fail(e.reason));
const tabs=['form','life','home'];
function selectTab(n){tabs.forEach((id,i)=>{$('tab-'+id).setAttribute('aria-selected',String(n===i));$('tab-'+id).tabIndex=n===i?0:-1;$('panel-'+id).hidden=n!==i;});}
tabs.forEach((id,i)=>{const b=$('tab-'+id);b.onclick=()=>selectTab(i);b.onkeydown=e=>{const n=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:null;if(n!==null){e.preventDefault();selectTab(n);$('tab-'+tabs[n]).focus();}};});

const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.05,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2;controls.maxDistance=36;controls.maxPolarAngle=Math.PI*.48;
const hemi=new THREE.HemisphereLight('#e4e9ec','#536455',2);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d9',3);sun.position.set(-5,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:1,far:35});sun.shadow.normalBias=.03;scene.add(sun);
const rim=new THREE.DirectionalLight('#b5b4ee',1.8);rim.position.set(5,6,-8);scene.add(rim);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.2,.3,1);composer.addPass(bloom);composer.addPass(new OutputPass());
const audio=new VegetationAudio();audio.setVolume(.45);
let model,meshes,serial=1,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,last=performance.now(),disposed=false;
function setPaused(value){paused=value;$('pause').textContent=value?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(value));if(value)audio.stop();}
function view(){
 const lily=species==='light-lily',solo=species==='scarlet-fish'&&$('school').value==='solo';
 const center=new THREE.Vector3(0,lily?0:-.6,lily?-1.8:0),distance=lily?16:solo?14:26;
 const dirs={quarter:[.55,.86,1],top:[0,1,.001],side:[.15,.24,1]};controls.target.copy(center);camera.position.fromArray(dirs[$('view').value]).normalize().multiplyScalar(distance).add(center);controls.update();
}
function lighting(){const night=$('light').value==='night';scene.background=new THREE.Color(night?'#211e2b':'#e9e9df');$('stage').classList.toggle('night',night);hemi.intensity=night?.65:2.5;sun.intensity=night?.85:3;rim.intensity=night?1.1:1.2;bloom.strength=night?.3:.08;if(meshes)meshes.night=night;}
function resize(){const w=$('stage').clientWidth,h=$('stage').clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.zoom=Math.min(1,camera.aspect*(w<=850?1.02:1.25));camera.setViewOffset(w,h,0,h*.025,w,h);camera.updateProjectionMatrix();}
function reset(){
 audio.stop();meshes?.dispose();model=new WaterStudy({species,school:$('school').value,seed,serial});meshes=new WaterMeshes(scene,model);meshes.clarity=Number($('clarity').value)/100;meshes.setSurface($('surface').checked);lighting();
 $('specimen').textContent=`Study ${String(serial).padStart(3,'0')} · ${model.fish.length} fish / ${model.plants.length} flowers`;
 const url=new URL(location.href);url.searchParams.set('species',species);url.searchParams.set('school',$('school').value);url.searchParams.delete('snail');history.replaceState(null,'',url);
 $('feedback').textContent='Sound starts only after an interaction.';view();resize();
}
$('school').onchange=reset;$('individual').onclick=()=>{serial++;reset();};$('light').onchange=lighting;
$('view').onchange=view;$('reset-view').onclick=view;$('pause').onclick=()=>setPaused(!paused);
$('surface').onchange=()=>meshes.setSurface($('surface').checked);$('clarity').oninput=()=>{meshes.clarity=Number($('clarity').value)/100;$('clarity-value').textContent=$('clarity').value+'%';};
function act(strong=false,point={x:0,z:1.5}){
 if(!model.plants.length)return;
 setPaused(false);if(!model.touch(point.x,point.z,strong))return;
 if(model.plants.length&&!strong)audio.unlock().catch(()=>{$('feedback').textContent='Sound is unavailable; the visual study is active.';});
 $('feedback').textContent=strong?'The flowers close a little, then settle.':'A little light travels between the flowers.';
}
$('touch').onclick=$('invite').onclick=()=>act();$('splash').onclick=$('startle').onclick=()=>act(true);
$('settle').onclick=()=>{setPaused(false);model.settle();audio.stop();$('feedback').textContent='Giving the pool space.';};
$('sound').onchange=()=>{audio.enabled=$('sound').checked;if(!audio.enabled)audio.suspend();};$('volume').oninput=()=>audio.setVolume(Number($('volume').value)/100);
$('stop-audio').onclick=()=>{audio.enabled=false;$('sound').checked=false;audio.suspend();$('feedback').textContent='Sound stopped. Enable it to hear the next reply.';};
const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);let pointer=null;
$('canvas').addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0){pointer=null;return;}pointer={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};});
$('canvas').addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>6)pointer.moved=true;});
$('canvas').addEventListener('pointercancel',()=>pointer=null);
$('canvas').addEventListener('pointerup',e=>{if(!pointer||pointer.moved||e.pointerId!==pointer.id){pointer=null;return;}pointer=null;const rect=$('canvas').getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const point=raycaster.ray.intersectPlane(plane,new THREE.Vector3());if(point)act(false,point);});
addEventListener('keydown',e=>{if(e.repeat||e.metaKey||e.ctrlKey||e.altKey||e.target.isContentEditable||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='KeyN'||e.code==='KeyS'){e.preventDefault();act(e.code==='KeyS');}});
addEventListener('blur',()=>{pointer=null;audio.suspend();});document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){pointer=null;audio.suspend();}});
const observer=new ResizeObserver(resize);observer.observe($('stage'));reset();setPaused(paused);
window.__waterStudy={get model(){return model;},get meshes(){return meshes;},renderer,scene,camera,audio,get paused(){return paused;}};
function frame(now){
 if(disposed)return;const dt=Math.min((now-last)/1000,.05);last=now;
 if(!paused&&!document.hidden)model.update(dt);
 for(const event of model.drainEvents())if(!paused&&!document.hidden)audio.play(event,model);
 controls.update();meshes.update(camera);composer.render();$('gesture-status').textContent=paused?'Paused · orbit to inspect the pose.':model.status;
 document.body.dataset.study=JSON.stringify({species,serial,school:model.school,fish:model.fish.length,plants:model.plants.length,time:model.time,paused,voices:audio.sources.size});requestAnimationFrame(frame);
}
addEventListener('pagehide',e=>{audio.suspend();if(e.persisted)return;disposed=true;observer.disconnect();meshes.dispose();audio.dispose();controls.dispose();composer.dispose();renderer.dispose();});
document.body.dataset.status='ready';requestAnimationFrame(frame);
