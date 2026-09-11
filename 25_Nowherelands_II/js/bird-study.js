import {BIRD_SPECIES} from './world/fauna/BirdSpecies.js?v=birds-10';
import {BirdEncounter} from './world/fauna/BirdEncounter.js?v=player-notes-13';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BirdJourney, BIRD_GROUND, BIRD_JOURNEY_TIME } from './world/fauna/BirdJourney.js?v=birds-10';
import { BirdMesh } from './world/fauna/BirdMesh.js?v=player-notes-13';

const $=id=>document.getElementById(id);
const reportError=message=>{ $('error').hidden=false; $('error').textContent=message; document.body.dataset.status='fail'; };
addEventListener('error',e=>reportError(e.message));
addEventListener('unhandledrejection',e=>reportError(String(e.reason)));
const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.3;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#dddcd2'); scene.fog=new THREE.Fog('#dddcd2',28,90);
const camera=new THREE.PerspectiveCamera(37,1,.05,150);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.08; controls.maxPolarAngle=Math.PI*.49; controls.minDistance=1.5; controls.maxDistance=60;
scene.add(new THREE.HemisphereLight('#eef4f6','#737660',2.7));
const sun=new THREE.DirectionalLight('#fff1d5',3.2); sun.position.set(-9,18,8); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-16,right:16,top:13,bottom:-13,near:1,far:45}); sun.shadow.bias=-.0003; sun.shadow.normalBias=.025; sun.shadow.radius=3; scene.add(sun);
const matte=color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(220,220),matte('#c0c2ac')); floor.rotation.x=-Math.PI/2; floor.position.y=-.012; floor.receiveShadow=true; scene.add(floor);
const bark=matte('#737363');
function limb(a,b,r1,r2,material=bark){
 const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,d.length(),5),material);
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); mesh.position.copy(p.add(q).multiplyScalar(.5)); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh); return mesh;
}
// The perch is the upper surface of this limb, not the branch centreline.
limb([8,-.05,0],[7.9,2.1,0],.24,.19); limb([7.9,2.1,0],[8.3,4.1,.15],.19,.11); limb([8.3,4.1,.15],[7.9,6,.25],.11,.018);
limb([7.9,2.1,0],[6.5,2.6,0],.17,.105); limb([6.5,2.6,0],[5,2.92,0],.105,.08); limb([5,2.92,0],[4.25,2.99,0],.08,.028);
limb([5.12,2.925,-.48],[5.12,2.925,.50],.075,.075);
limb([6.2,2.66,0],[6.0,3.6,-.18],.055,.012); limb([8.22,3.8,.14],[9.4,4.9,.55],.1,.01);
limb([8.06,5.2,.2],[7.1,5.9,.55],.05,.008);
let seed=29; const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
// Sparse low grass leaves the silhouette and its ground contact exposed.
const grassPositions=[],grassColors=[];
for(let i=0;i<1500;i++){
 const x=(rnd()-.5)*70,z=(rnd()-.5)*55;
 if(Math.hypot(x-BIRD_GROUND.x,z-BIRD_GROUND.z)<1.15 || Math.hypot(x,z)<2 || rnd()<.25) continue;
 const h=.08+rnd()*.23,w=.015+rnd()*.025,a=rnd()*Math.PI,dx=Math.cos(a)*w,dz=Math.sin(a)*w;
 grassPositions.push(x-dx,0,z-dz,x+dx,0,z+dz,x+.1*h,h,z);
 const c=new THREE.Color().setHSL(.15+rnd()*.035,.12,.35+rnd()*.15); for(let j=0;j<3;j++)grassColors.push(c.r,c.g,c.b);
}
const grassGeometry=new THREE.BufferGeometry();grassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(grassPositions,3));grassGeometry.setAttribute('color',new THREE.Float32BufferAttribute(grassColors,3));grassGeometry.computeVertexNormals();
scene.add(new THREE.Mesh(grassGeometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1})));
const distant=matte('#8e9780');
for(let i=0;i<22;i++){
 const x=(rnd()-.5)*100,z=-16-rnd()*40,h=4+rnd()*10;
 limb([x,0,z],[x+.3,h,z],.14,.04,distant);
 const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),distant); crown.position.set(x,h,z);crown.scale.set(1.8+rnd()*2,h*.35,2+rnd()*2);scene.add(crown);
}
for(let i=0;i<28;i++){
 const x=(rnd()-.5)*36,z=(rnd()-.5)*25;if(Math.hypot(x+5,z-1)<1.6)continue;
 const stone=new THREE.Mesh(new THREE.IcosahedronGeometry(.1+rnd()*.18,0),matte('#a8ad9b'));stone.position.set(x,.045,z);stone.scale.y=.4;stone.rotation.y=rnd()*6;stone.receiveShadow=true;scene.add(stone);
}
const journey=new BirdJourney(BIRD_SPECIES[0]),bird=new BirdMesh(scene,4);
const comparison=BIRD_SPECIES.map(profile=>new BirdJourney(profile));
let species=0;
const companions=[[-3,0,3.2],[-6.7,0,4.2],[-7,0,-1.5]].map(([x,y,z],i)=>{
 const e=new BirdEncounter({x,y,z},{x:5,y:3,z:0},BIRD_SPECIES[i].size/2.8,{species:i});e.variant=[0,2,1][i];
 e.journey.idleTime=i*1.1;e.enableForaging({seed:31+i*71,sample:()=>0});return e;
});
$('timeline').max=String(BIRD_JOURNEY_TIME);
let paused=false,slow=false,last=performance.now(),lastState='',view='encounter',trackingYaw=0;
const labels={ground:['Foraging','Pecking, stretching and watching'],alert:['Alert','A moment of attention'],crouch:['Ready','Weight shifts before departure'],takeoff:['Taking flight','A push, then strong wingbeats'],flight:['In flight','Wings carry the climb and turn'],glide:['Gliding','Wings open; a quiet arc'],landing:['Coming to rest','Tail opens, feet reach forward'],settle:['Touchdown','Feet hold; wings fold away'],perched:['Settled','Watching from the branch']};
function setPaused(value){paused=value;$('pause').textContent=paused?'Play':'Pause';$('pause').setAttribute('aria-label',paused?'Play animation':'Pause animation');}
function setView(){
 view=$('view').value;document.querySelector('h1').textContent=view==='varieties'?'Birds of the clearing.':'Ground to branch.'; const pose=journey.sample(),p=pose.position,center=new THREE.Vector3(p.x,p.y,p.z);trackingYaw=pose.yaw;
 const dirs={follow:[.6,.35,1],side:[0,.13,1],front:[1,.18,.01],top:[0,1,.001]};
 if(view==='varieties'){controls.target.set(0,.6,0);camera.position.set(3.4,2.6,10.8);}
 else if(view==='encounter') { controls.target.set(.3,2.25,0);camera.position.set(1.6,7.1,25.5); }
 else {controls.target.copy(center);camera.position.fromArray(dirs[view]).normalize().multiplyScalar(view==='follow'?5:3.6);if(view==='side'||view==='front')camera.position.applyAxisAngle(new THREE.Vector3(0,1,0),pose.yaw);camera.position.add(center);}
 controls.update();
}
$('view').onchange=()=>{setView();$('species').disabled=view==='varieties';};
$('species').onchange=()=>{species=Number($('species').value);Object.assign(journey,{idleTempo:BIRD_SPECIES[species].idleTempo,flapRate:BIRD_SPECIES[species].flapRate});};
if(new URLSearchParams(location.search).get('view')==='varieties'){$('view').value='varieties';$('species').disabled=true;}

$('start').onclick=()=>{if(journey.start())setPaused(false);};
$('replay').onclick=()=>{journey.reset();journey.start();setPaused(false);};
$('pause').onclick=()=>setPaused(!paused);
$('slow').onclick=()=>{slow=!slow;$('slow').setAttribute('aria-pressed',String(slow));};
$('timeline').oninput=e=>{journey.seek(Number(e.target.value));setPaused(true);};
addEventListener('keydown',e=>{if(['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();setPaused(!paused);}if(e.code==='KeyR'){$('replay').click();}});
function resize(){
 renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 // Leave space beneath the scene for the encounter controls.
 camera.setViewOffset(innerWidth,innerHeight,0,Math.min(70,innerHeight*.1),innerWidth,innerHeight);
 if(view==='encounter' && innerWidth<650) {camera.position.set(1.6,8,37);controls.target.set(.3,2.25,0);}
}
setView();resize();addEventListener('resize',()=>{setView();resize();});
function frame(now){
 const dt=Math.min((now-last)/1000,.04)*(slow?.25:1);last=now;
 const pose=journey.update(paused?0:dt);pose.species=species;pose.variant=[0,2,1][species];
 const variants=comparison.map((j,i)=>{const p=j.update(paused?0:dt),size=BIRD_SPECIES[i].size/2.8;p.position={x:(i-1)*2.5,y:p.position.y*size,z:0};p.size=size;p.species=i;p.variant=[0,2,1][i];return p;});
 bird.update(view==='varieties'?variants:[pose,...companions.map(e=>e.update(paused?0:dt))]);
 if(view!=='encounter'&&view!=='varieties'){
  if(view==='side'||view==='front')camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),pose.yaw-trackingYaw).add(controls.target);
  const center=new THREE.Vector3(pose.position.x,pose.position.y,pose.position.z),delta=center.clone().sub(controls.target);
  camera.position.add(delta);controls.target.copy(center);
 }
 trackingYaw=pose.yaw;
 controls.update();renderer.render(scene,camera);
 if(view==='varieties'){$('state').textContent='Three shapes';$('description').textContent='Roundtail · Longtail · Crowncrest';lastState='varieties';}
 else if(lastState!==pose.state){const [name,detail]=labels[pose.state];$('state').textContent=name;$('description').textContent=detail;lastState=pose.state;}
 $('timeline').value=String(journey.time);
 $('start').disabled=journey.active||view==='varieties';$('replay').disabled=view==='varieties';$('timeline').disabled=view==='varieties';$('start').textContent=journey.completed&&!journey.returning?'Return to ground':'Startle bird';
 document.body.dataset.bird=JSON.stringify({species,view,variants:variants.map(p=>p.species),state:pose.state,time:journey.time,idleTime:journey.idleTime,activity:pose.activity,companions:companions.map(e=>({activity:e.pose.activity,position:e.pose.position,hops:e.forage.hops,variant:e.variant})),position:pose.position,speed:pose.speed,fold:pose.fold,contact:pose.contact,paused,returning:journey.returning});
 if($('error').hidden)document.body.dataset.status='ready';
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if(new URLSearchParams(location.search).has('check')){
 try{
  const {checkBirdRendering}=await import('../tests/BirdRenderChecks.js?v=player-notes-13');
  document.body.dataset.birdChecks=JSON.stringify(BIRD_SPECIES.map((_,i)=>checkBirdRendering(bird.geometry,i)));
 }catch(e){reportError(e.message);console.error(e);}
}
