import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mountAtelierNavigation } from './atelier/AtelierCatalog.js?v=water-2';
import { VegetationStudy } from './atelier/VegetationStudy.js';
import { VegetationMeshes } from './atelier/VegetationMeshes.js';
import { VegetationAudio } from './atelier/VegetationAudio.js';
import { Random } from './core/Random.js';

const $ = id => document.getElementById(id), params = new URLSearchParams(location.search);
const species = params.get('species') === 'veil-willow' ? 'veil-willow' : 'bell-reed', willow = species === 'veil-willow';
const seed = mountAtelierNavigation(species) || 'stillwater';
const fail = error => { $('error').hidden=false; $('error').textContent=error.message || String(error); document.body.dataset.status='fail'; };
addEventListener('error', event=>fail(event.error || event.message)); addEventListener('unhandledrejection', event=>fail(event.reason));
document.title = `${willow?'Veil willows':'Bell reeds'} · Vegetation atelier`;
$('name').textContent = willow?'Veil willows.':'Bell reeds.';
$('intro').textContent = willow?'A little wind, a hanging leaf. Occasionally, a mirror.':'A small instrument at the water’s edge.';
$('character-title').textContent = willow?'Three forms. One species.':'A quiet answering voice.';
$('character').textContent = willow?'Long ribbons, folded sprays and broken veils share an open, leaning crown.':'Open seed husks on slender stems. Young, mature and weathered clumps keep the same family resemblance.';
$('form-title').textContent = willow?'The hanging crown.':'The open husk.';
$('form-note').textContent = willow?'Each tree has its own foliage form. Choose a mixed grove to compare all three together.':'All three growth forms keep the open husk. Compare a compact young plant, a full clump and a leaning weathered one.';
$('interaction-note').textContent = willow?'The tree follows the breeze. Its optional mirrors swing from fixed attachments, turn slightly toward you and ring when played.':'Offer a note and listen for a small answer. Brush past to see stems yield around a passing visitor. Repeated notes leave time for the plant to settle.';
$('home-title').textContent = willow?'Sheltered lake banks':'Quiet freshwater margins';
$('home-detail').textContent = willow?'Occasional smaller trees between the low shore plants and the distant giant groves. Their open crowns leave water and sky visible.':'Small irregular patches along slow shallows and sheltered backwaters, with exposed wet ground between clumps.';
$('habitat-fact').textContent = willow?'A rare tree carrying mirrors':'A response within the patch';
$('habitat-detail').textContent = willow?'The pendants sketch a possible home for the existing mirror encounters. Most willows would carry only leaves.':'Each husk shelters a dim, warm bulb. Answering bulbs brighten in sequence; a stronger invitation reaches more of the group.';
$('pendants-field').hidden = !willow; $('reed-actions').hidden = willow; $('willow-actions').hidden = !willow;
const forms = willow?[['ribbons','A / Long ribbons'],['sprays','B / Folded sprays'],['veils','C / Broken veils'],['mixed','All three · mixed grove']]
 :[['young','Young · compact'],['mature','Mature · open'],['weathered','Weathered · leaning'],['mixed','All ages · mixed patch']];
for(const [value,text] of forms){const option=new Option(text,value);$('variation').add(option);}
$('variation').value=forms.some(([v])=>v===params.get('form'))?params.get('form'):willow?'sprays':'mature';
if(params.get('group')==='1'||$('variation').value==='mixed')$('group').value='group';
const tabs=['form','life','home'];
function selectTab(index){tabs.forEach((id,i)=>{$('tab-'+id).setAttribute('aria-selected',String(i===index));$('tab-'+id).tabIndex=i===index?0:-1;$('panel-'+id).hidden=i!==index;});}
tabs.forEach((id,i)=>{const button=$('tab-'+id);button.onclick=()=>selectTab(i);button.onkeydown=e=>{const next=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:null;if(next!==null){e.preventDefault();selectTab(next);$('tab-'+tabs[next]).focus();}};});

const renderer = new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.05,150);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2;controls.maxDistance=40;controls.maxPolarAngle=Math.PI*.49;
const hemisphere=new THREE.HemisphereLight('#e5e1ee','#65546a',2.4);scene.add(hemisphere);
const sun=new THREE.DirectionalLight('#ffe8d2',3.1);sun.position.set(-6,13,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:1,far:40});sun.shadow.normalBias=.025;scene.add(sun);
const rim=new THREE.DirectionalLight('#c2b9ed',1.7);rim.position.set(5,7,-8);scene.add(rim);
const pmrem=new THREE.PMREMGenerator(renderer), room=new THREE.Scene();room.background=new THREE.Color('#8b8295');
const panel=new THREE.Mesh(new THREE.PlaneGeometry(8,5),new THREE.MeshBasicMaterial({color:'#ede7db',side:THREE.DoubleSide}));panel.position.set(-3,3,4);room.add(panel);
const environment=pmrem.fromScene(room);scene.environment=environment.texture;scene.environmentIntensity=.35;
panel.geometry.dispose();panel.material.dispose();pmrem.dispose();
const floorMat=new THREE.MeshStandardMaterial({color:'#b9b3b0',roughness:1,flatShading:true});
const floor=new THREE.Mesh(new THREE.CylinderGeometry(13,13,.18,80),floorMat);floor.position.y=-.1;floor.receiveShadow=true;scene.add(floor);
const rocks=new THREE.Group();scene.add(rocks);const random=new Random('atelier-shore'), rockGeo=new THREE.IcosahedronGeometry(1,0),rockMat=new THREE.MeshStandardMaterial({color:'#a49fa8',roughness:1,flatShading:true});
for(let i=0;i<32;i++){const a=random.range(0,Math.PI*2),r=random.range(8,11),s=random.range(.12,.45),rock=new THREE.Mesh(rockGeo,rockMat);rock.position.set(Math.cos(a)*r,s*.15,Math.sin(a)*r);rock.scale.set(s*1.5,s*.65,s);rock.rotation.y=a;rock.castShadow=true;rocks.add(rock);}
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.15,.4,1);composer.addPass(bloom);composer.addPass(new OutputPass());
const audio=new VegetationAudio();let model,meshes,serial=1,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,mirrorIndex=0,last=performance.now(),disposed=false;
function setPaused(value){paused=value;$('pause').textContent=value?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(value));if(value)audio.stop();}
function view(){
 const group=$('group').value==='group',center=new THREE.Vector3(0,willow?2.7:1.7,0);
 const distance=willow?(group?25:15):(group?14:9.7),dirs={quarter:[.52,.32,1],front:[0,.14,1],side:[1,.17,0],top:[0,1,.001]};
 controls.target.copy(center);camera.position.fromArray(dirs[$('view').value]).normalize().multiplyScalar(distance).add(center);controls.update();
}
function reset(){
 audio.stop();meshes?.dispose();
 model=new VegetationStudy({species,form:$('variation').value,seed,serial,group:$('group').value==='group',pendants:$('pendants').value==='on'});
 model.wind=Number($('wind').value)/100;meshes=new VegetationMeshes(scene,model,camera);
 $('specimen').textContent=`${model.group?'Group':'Specimen'} ${String(serial).padStart(3,'0')} / ${forms.find(([v])=>v===model.form)[1]}`;
 $('play-mirror').disabled=!model.pendants;$('feedback').textContent=willow&&!model.pendants?'An ordinary willow. Add pendants in Form to play the mirrors.':'Choose an action to begin.';
 const url=new URL(location.href);url.searchParams.set('species',species);url.searchParams.set('form',model.form);url.searchParams.set('group',model.group?'1':'0');history.replaceState(null,'',url);
 mirrorIndex=0;view();resize();
}
function lighting(){const night=$('light').value==='night';$('stage').classList.toggle('night',night);scene.background=new THREE.Color(night?'#211d2b':'#e9e9df');floorMat.color.set(night?'#38303f':'#b9b3b0');rockMat.color.set(night?'#48404f':'#a49fa8');hemisphere.intensity=night?1.2:2.4;sun.intensity=night?1.1:3.1;rim.intensity=night?2.2:1.7;bloom.strength=night?.24:.08;}
$('variation').onchange=()=>{if($('variation').value==='mixed')$('group').value='group';reset();};
$('group').onchange=()=>{if($('group').value==='single'&&$('variation').value==='mixed')$('variation').value=willow?'sprays':'mature';reset();};
$('individual').onclick=()=>{serial++;reset();};$('pendants').onchange=reset;$('view').onchange=view;$('reset-view').onclick=view;$('light').onchange=lighting;
$('wind').oninput=()=>{model.wind=Number($('wind').value)/100;$('wind-value').textContent=$('wind').value+'%';};
$('pause').onclick=()=>setPaused(!paused);
function action(kind,charge=0,target){
 setPaused(false);audio.unlock().catch(()=>{$('feedback').textContent='Sound is unavailable; the visual study is still active.';});
 const accepted=kind==='note'?model.offerNote(charge,'player',target):kind==='brush'?model.brush():model.touchMirror(target?.plant??0,target?.part??mirrorIndex++%2);
 $('feedback').textContent=accepted?(kind==='note'?'Listen for the answer inside the husks.':kind==='brush'?'The small ring marks a passing visitor.':'A little swing, then a lingering ring.'):'Let the current gesture settle, then try again.';
}
$('offer-note').onclick=()=>action('note');$('strong-note').onclick=()=>action('note',1);$('brush').onclick=()=>action('brush');$('play-mirror').onclick=()=>action('mirror');
$('volume').oninput=()=>audio.setVolume(Number($('volume').value)/100);
$('sound').onchange=()=>{audio.enabled=$('sound').checked;if(!audio.enabled)audio.stop();};
$('stop-audio').onclick=()=>{audio.enabled=false;$('sound').checked=false;audio.stop();$('feedback').textContent='Sound stopped. Enable sound to listen again.';};
let keyStart=null,pointer=null;const raycaster=new THREE.Raycaster();
addEventListener('keydown',e=>{if(e.code!=='KeyN'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.isContentEditable||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;e.preventDefault();keyStart=performance.now();});
addEventListener('keyup',e=>{if(e.code!=='KeyN'||keyStart===null)return;const charge=Math.min(1,Math.max(0,(performance.now()-keyStart-280)/1100));keyStart=null;if(!document.hidden)action(willow?'mirror':'note',charge);});
$('canvas').addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0){pointer=null;return;}pointer={x:e.clientX,y:e.clientY,id:e.pointerId,time:performance.now(),moved:false};});
$('canvas').addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>6)pointer.moved=true;});
$('canvas').addEventListener('pointercancel',()=>pointer=null);
$('canvas').addEventListener('pointerup',e=>{
 if(!pointer||pointer.moved||pointer.id!==e.pointerId){pointer=null;return;}
 const charge=Math.min(1,Math.max(0,(performance.now()-pointer.time-280)/1100));pointer=null;
 const rect=$('canvas').getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
 const hit=raycaster.intersectObjects(meshes.picks,false)[0];
 if(!willow)action('note',charge,hit?.object.userData);else if(hit)action('mirror',0,hit.object.userData);
});
addEventListener('blur',()=>{keyStart=null;pointer=null;audio.suspend();});
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){keyStart=null;pointer=null;audio.suspend();}});
function resize(){const w=$('stage').clientWidth,h=$('stage').clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;const compact=w<=850&&h<700,fit=model?.group?(willow?.78:1.05):(compact?.92:1.4);camera.zoom=Math.min(1,camera.aspect*fit);camera.setViewOffset(w,h,0,-h*.025,w,h);camera.updateProjectionMatrix();}
const observer=new ResizeObserver(resize);observer.observe($('stage'));
reset();lighting();resize();setPaused(paused);
// Read-only debug access for geometry and lifecycle checks in a browser.
window.__vegetationStudy={get model(){return model;},get meshes(){return meshes;},renderer,camera,scene,audio};
function frame(now){
 if(disposed)return;
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(!paused&&!document.hidden)model.update(dt);
 for(const event of model.drainEvents())if(!paused&&!document.hidden)audio.play(event,model);
 controls.update();meshes.update(camera);composer.render();
 $('gesture-status').textContent=paused?'Paused':model.status;
 document.body.dataset.study=JSON.stringify({species,form:model.form,group:model.group,serial,paused,time:model.time,plants:model.plants.length,mirrors:meshes.mirrors.length,pending:model.pending.length,voices:audio.sources.size,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});
 requestAnimationFrame(frame);
}
addEventListener('pagehide',e=>{audio.suspend();if(e.persisted)return;disposed=true;observer.disconnect();meshes.dispose();audio.dispose();controls.dispose();composer.dispose();environment.dispose();floor.geometry.dispose();floorMat.dispose();rockGeo.dispose();rockMat.dispose();renderer.dispose();});
document.body.dataset.status='ready';requestAnimationFrame(frame);
