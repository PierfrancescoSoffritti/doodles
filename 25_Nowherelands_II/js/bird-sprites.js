import * as THREE from 'three';
import {BirdPassages,SKY_BIRD_CAPACITY} from './world/fauna/BirdPassages.js?v=birds-10';
import {BirdSprites} from './world/fauna/BirdSprites.js?v=birds-10';
const $=id=>document.getElementById(id);
const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color('#d9ded9');scene.fog=new THREE.Fog('#d9ded9',65,220);
const camera=new THREE.PerspectiveCamera(55,1,.1,500);camera.position.set(0,1.7,20);
scene.add(new THREE.HemisphereLight('#f0f4ed','#788270',2.5));const sun=new THREE.DirectionalLight('#fff3d9',2);sun.position.set(-50,70,25);scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(900,900),new THREE.MeshStandardMaterial({color:'#b0bbaa',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;scene.add(ground);
const bark=new THREE.MeshStandardMaterial({color:'#768172',roughness:1,flatShading:true});
function branch(a,b,r1,r2){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p),m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,d.length(),5),bark);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());m.position.copy(p.add(q).multiplyScalar(.5));scene.add(m);}
let seed=91;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const distant=new THREE.MeshStandardMaterial({color:'#8c9d89',roughness:1,flatShading:true});
for(let i=0;i<45;i++){const x=(rnd()-.5)*420,z=-100-rnd()*170,h=9+rnd()*13;branch([x,0,z],[x,h,z],.3,.1);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),distant);crown.scale.set(3+rnd()*3,h*.35,3+rnd()*3);crown.position.set(x,h,z);scene.add(crown);}
const grass=[],color=new THREE.MeshBasicMaterial({color:'#98a68f',side:THREE.DoubleSide});
for(let i=0;i<2000;i++){const x=(rnd()-.5)*160,z=40-rnd()*230,h=.05+rnd()*.23;grass.push(x-.04,0,z,x+.04,0,z,x+.06,h,z);}
const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(grass,3));scene.add(new THREE.Mesh(gg,color));
const model=new BirdPassages({corridorOffset:145}),sprites=new BirdSprites(scene,SKY_BIRD_CAPACITY);
let yaw=0,pitch=.38,walking=false,paused=false,last=performance.now(),pointer=null;const keys=new Set();
function walk(value){walking=value;$('walk').textContent=value?'Stop walking':'Walk';$('walk').setAttribute('aria-pressed',String(value));}
$('walk').onclick=()=>walk(!walking);$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume birds':'Pause birds';if(paused)walk(false);};
$('reset').onclick=()=>{model.reset();camera.position.set(0,1.7,20);yaw=0;pitch=.38;walk(false);paused=false;$('pause').textContent='Pause birds';$('view').value='clearing';};
$('view').onchange=()=>{pitch=$('view').value==='sky'?.65:.38;};
addEventListener('keydown',e=>{if(['BUTTON','SELECT','INPUT'].includes(document.activeElement.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();pointer=null;walk(false);});
$('canvas').onpointerdown=e=>{document.activeElement?.blur();pointer={x:e.clientX,y:e.clientY,id:e.pointerId};$('canvas').setPointerCapture(e.pointerId);};
$('canvas').onpointermove=e=>{if(!pointer)return;yaw-=(e.clientX-pointer.x)*.003;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-pointer.y)*.003,-.25,.85);pointer.x=e.clientX;pointer.y=e.clientY;};
$('canvas').onpointerup=$('canvas').onpointercancel=()=>pointer=null;
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}resize();addEventListener('resize',resize);
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 let forward=(walking||keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
 if(!paused){const length=Math.hypot(forward,side)||1;forward/=length;side/=length;camera.position.x+=(Math.sin(yaw)*forward+Math.cos(yaw)*side)*6*dt;camera.position.z+=(-Math.cos(yaw)*forward+Math.sin(yaw)*side)*6*dt;
  camera.position.x=THREE.MathUtils.clamp(camera.position.x,-85,85);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-190,35);model.setObserver(camera.position);model.update(dt);}
 camera.lookAt(camera.position.x+Math.sin(yaw)*Math.cos(pitch),camera.position.y+Math.sin(pitch),camera.position.z-Math.cos(yaw)*Math.cos(pitch));camera.updateMatrixWorld();sprites.update(model.birds);renderer.render(scene,camera);
 const gliding=model.birds.filter(b=>b.glide).length,circling=model.birds.filter(b=>b.pattern==='circling').length;
 document.body.dataset.skyPattern=circling?'circling':'passing';
 $('count').textContent=`${model.birds.length} in the sky · ${gliding} gliding${circling?` · ${circling} circling`:``}`;
 $('distance').textContent=circling?'A distant flock circles, then continues on':'Slower wingbeats · separate flock routes';
 document.body.dataset.sprites=JSON.stringify({airborne:model.birds.length,gliding,circling,flocks:new Set(model.birds.map(b=>b.group)).size,variants:[...new Set(model.birds.map(b=>b.variant))],player:camera.position,time:model.time,paused,quads:sprites.geometry.instanceCount,worldOriented:true});
 requestAnimationFrame(frame);
}requestAnimationFrame(frame);
