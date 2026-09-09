import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ATELIER_SPECIES, atelierURL, mountAtelierNavigation } from './atelier/AtelierCatalog.js?v=1';
import { AtelierFauna } from './atelier/AtelierFauna.js?v=1';
import { createReedAudioScene } from './audio/ReedWalkerAudioScene.js?v=atelier-1';
import { FaunaAudio } from './audio/FaunaAudio.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const species=ATELIER_SPECIES.find(s=>s.id===params.get('species'))||ATELIER_SPECIES[0];
if(species.id==='reed'){location.replace(atelierURL('reed',params.get('seed')||''));}else{start();}
function start(){
 const fail=e=>{$('error').hidden=false;$('error').textContent=e.message||String(e);document.body.dataset.status='fail';};
 addEventListener('error',e=>fail(e));addEventListener('unhandledrejection',e=>fail(e.reason));
 mountAtelierNavigation(species.id);document.title=species.name+' · Fauna atelier';
 $('name').textContent=species.name+'.';$('folio').textContent='Nowherelands / Fauna atelier / '+species.number;$('intro').textContent=species.intro;$('intro').style.whiteSpace='pre-line';
 $('character-title').textContent=species.title;$('character').textContent=species.character;$('home-title').textContent=species.home;$('home-detail').textContent=species.habitat;$('form-title').textContent=species.title;
 for(const [title,detail] of species.traits){const fact=document.createElement('div');fact.className='fact';const h=document.createElement('strong'),p=document.createElement('p');h.textContent=title;p.textContent=detail;fact.append(h,p);$('panel-life').append(fact);}
 const tabNames=[['form','01 Form'],['voice','02 Voice'],['home','03 Home'],['life','04 Traits']];
 const tabs=tabNames.map(([id,title])=>{const b=document.createElement('button');b.id='tab-'+id;b.role='tab';b.textContent=title;b.setAttribute('aria-controls','panel-'+id);document.querySelector('.tabs').append(b);return b;});
 function selectTab(index){tabs.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;$('panel-'+tabNames[i][0]).hidden=i!==index;});}
 tabs.forEach((b,i)=>{b.onclick=()=>selectTab(i);b.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%4;if(e.key==='ArrowLeft')next=(i+3)%4;if(e.key==='Home')next=0;if(e.key==='End')next=3;if(next!==undefined){e.preventDefault();selectTab(next);tabs[next].focus();}};});selectTab(0);
 const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.05,400);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=2;controls.maxDistance=150;
 const hemi=new THREE.HemisphereLight('#edf1e6','#77755b',2.7);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#fff1d5',3);sun.position.set(-15,30,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:90});sun.shadow.normalBias=.025;scene.add(sun);
 const matte=color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});
 const floor=new THREE.Mesh(new THREE.CylinderGeometry(species.id==='hopper'?65:18,species.id==='hopper'?65:18,.25,64),matte('#b5b89b'));floor.position.y=-.14;floor.receiveShadow=true;scene.add(floor);
 let seed=43;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const prop=(geometry,material,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;};
 const stoneGeo=new THREE.IcosahedronGeometry(1,0),stone=matte('#c6c5ac'),grass=matte('#7d8b5f');
 for(let i=0;i<70;i++){const a=rnd()*6.28,r=9+rnd()*8,s=.2+rnd()*.55;prop(stoneGeo,stone,Math.cos(a)*r,.05,Math.sin(a)*r,s,s*.4,s*.8);}
 const grassGeo=new THREE.ConeGeometry(.14,1,3);
 for(let i=0;i<240;i++){const a=rnd()*6.28,r=11+rnd()*6,h=.4+rnd();prop(grassGeo,grass,Math.cos(a)*r,h*.5,Math.sin(a)*r,1,h,1);}
 if(species.id==='lumen'){
  const water=new THREE.Mesh(new THREE.CircleGeometry(13,64),new THREE.MeshStandardMaterial({color:'#8ea99b',roughness:.65,transparent:true,opacity:.6}));water.rotation.x=-Math.PI/2;water.position.y=.02;scene.add(water);
 }
 if(species.bird!==undefined){
  const bark=matte('#706e59');prop(new THREE.CylinderGeometry(.2,.4,8,6),bark,5,4,0);
  const branch=prop(new THREE.CylinderGeometry(.1,.1,7,6),bark,5,7.9,0);branch.rotation.x=Math.PI/2;
  $('palette-field').hidden=false;$('individual').querySelector('small').textContent='Different proportions and rhythm · choose plumage below';
 }
 const actor=new AtelierFauna(scene,renderer,species);let paused=false;
 if(species.id==='firefly'){actor.group=true;actor.reset();$('group').value='group';}
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.42,.45,.78);composer.addPass(bloom);composer.addPass(new OutputPass());
 function lighting(){const night=$('light').value==='night';scene.background=new THREE.Color(night?'#182328':'#e9e9df');$('stage').classList.toggle('night',night);hemi.intensity=night?.35:2.7;sun.intensity=night?.8:3;actor.shared.sun.intensity=night?0:1;actor.shared.night=night?1:0;bloom.strength=night?.42:.08;}
 if(species.id==='lumen'||species.id==='firefly')$('light').value='night';lighting();$('light').onchange=lighting;
 const dirs={quarter:[.65,.45,1],side:[0,.15,1],front:[1,.15,0],top:[0,1,.001]};
 function view(){controls.target.copy(actor.center());camera.position.fromArray(dirs[$('view').value]).normalize().multiplyScalar(actor.distance()).add(controls.target);controls.update();}
 $('view').onchange=view;$('reset-view').onclick=view;
 function caption(){ $('specimen').textContent=(actor.group?'Group ':'Individual ')+String(actor.serial).padStart(3,'0');$('individual').firstChild.textContent=actor.group?'Another group ':'Another individual '; }
 const buttons=[];
 function markAction(mode){buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));}
 for(const [mode,label] of species.actions||[['rest','Forage'],['fly','Ground ↔ branch']]){const b=document.createElement('button');b.textContent=label;b.dataset.mode=mode;b.onclick=()=>{actor.act(mode);paused=false;$('pause').textContent='Pause';$('pause').setAttribute('aria-pressed','false');markAction(mode);};$('gestures').append(b);buttons.push(b);}markAction('rest');
 function reset(){actor.reset();markAction('rest');caption();view();}
 $('group').onchange=()=>{actor.group=$('group').value==='group';reset();};$('individual').onclick=reset;$('palette').onchange=()=>{actor.palette=Number($('palette').value);reset();};
 $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Play':'Pause';$('pause').setAttribute('aria-pressed',String(paused));};
 $('form-note').textContent=species.id==='lumen'?'Movement stays centered so you can compare the breathing volume, swimming stroke and escape deformation.':species.id==='hopper'?'Approach brings a visitor closer to the colony. Give space lets it settle again. The view follows the animals.':species.bird!==undefined?'Watch quiet foraging, then send the bird to the branch and back. Compare its silhouette from different angles.':'The light points are enlarged for inspection. Study one mote or the whole group. Sound response previews how their light reacts to the world’s audio.';
 let fixture=null,audio=null,phraseTimer=null,audioPending=false,audioGeneration=0;
 async function stopAudio(){audioGeneration++;clearInterval(phraseTimer);audio?.dispose();audio=null;const old=fixture;fixture=null;await old?.dispose();$('sound-status').textContent='Listening stopped.';}
 async function sound(event){
  if(!fixture){const generation=audioGeneration,ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();if(generation!==audioGeneration){await ctx.close();return;}fixture=createReedAudioScene(ctx,{background:$('sound-bed').value});audio=new FaunaAudio(fixture.engine,fixture.conductor);fixture.phrase(ctx.currentTime);phraseTimer=setInterval(()=>fixture?.phrase(fixture.engine.now),4800);}
  fixture.engine.master.gain.value=Number($('volume').value)/100*.9;
  const c=actor.subject,p=c.renderPosition||c.pos;fixture.listener={x:p.x+10,y:p.y+3,z:p.z+5};fixture.engine.updateListener(fixture.listener,{x:0,y:0,z:-1},{x:0,y:1,z:0});
  const played=species.id==='hopper'?audio.pebble(c,event,{listener:fixture.listener}):audio.call(c,false,event==='escape');
  $('sound-status').textContent=played?'Listening · '+event:'Let the current sound finish, then try again.';
 }
 const voiced=Boolean(species.voices?.length);$('listening').hidden=!voiced;
 $('voice-note').textContent=voiced?'Hear this animal’s game sounds alone or against music, wind and water.':'This fauna currently has no dedicated voice in the game. This panel leaves room to develop its sound character together.';
 if(voiced){const label=document.createElement('label');label.className='field';label.innerHTML='<span>Surrounding sounds</span><select id="sound-bed"><option value="solo">Creature only</option><option value="river">River · wind &amp; water</option><option value="busy">Busy · music, rain &amp; water</option></select>';$('voices').append(label);$('sound-bed').onchange=()=>stopAudio();}
 for(const [event,title] of species.voices||[]){const b=document.createElement('button');b.className='action';b.textContent=title;b.onclick=async()=>{if(audioPending)return;audioPending=true;b.disabled=true;try{await sound(event);}catch(e){fail(e);}finally{audioPending=false;b.disabled=false;}};$('voices').append(b);}
 $('volume').oninput=()=>{if(fixture)fixture.engine.master.gain.setTargetAtTime(Number($('volume').value)/100*.9,fixture.engine.now,.05);};$('stop-audio').onclick=()=>stopAudio();
 addEventListener('pagehide',()=>stopAudio());document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();});
 function resize(){const w=$('stage').clientWidth,h=$('stage').clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.zoom=Math.min(1,camera.aspect*1.25);camera.setViewOffset(w,h,0,-h*.09,w,h);camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe($('stage'));resize();caption();view();let last=performance.now();
 function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;actor.update(paused||document.hidden?0:dt);const delta=actor.center().sub(controls.target);if(species.id==='hopper'||(species.id==='firefly'||species.bird!==undefined)&&!actor.group){camera.position.add(delta);controls.target.add(delta);}controls.update();audio?.update();composer.render();$('gesture-status').textContent=actor.status;document.body.dataset.study=JSON.stringify({species:species.id,group:actor.group,serial:actor.serial,state:actor.status,paused});requestAnimationFrame(frame);}
 document.body.dataset.status='ready';requestAnimationFrame(frame);
}
