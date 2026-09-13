import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {FaunaMeshes} from '../../js/world/fauna/FaunaMeshes.js?v=stable-30-25';
import {FaunaModel} from '../../js/world/fauna/FaunaModel.js?v=stable-30-25';
import {createFogUniforms} from '../../js/world/FogGlsl.js';

export async function checkFaunaVisibility(){
 const renderer=new THREE.WebGLRenderer({antialias:false}),scene=new THREE.Scene();renderer.setSize(360,240);document.body.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(66,1.5,.5,10000);camera.position.set(0,20,60);
 const shared={camera,renderer,moon:{dir:new THREE.Vector3(0,1,0),intensity:1},sun:{intensity:.2},fogUniforms:createFogUniforms(),caveAmount:0};
 const model=new FaunaModel('view-culling',{sample:()=>({ground:-10,water:-5,slope:0,foam:0,hardness:0,roof:false,forest:0,wet:1,coast:0}),lakes:[]});model.addGroup('visibility','lumen',0,0,4);model.addGroup('pebbles','hopper',0,0,4,{sample:()=>({ground:0,water:-10,slope:0,foam:0,hardness:1,roof:false,forest:0,wet:0,coast:1})});model.listener=camera.position;model.time=10;
 for(let i=0;i<model.creatures.length;i++){
  const c=model.creatures[i],angle=i*2.39996323,radius=35+(i%17)*22;
  Object.assign(c.pos,{x:Math.sin(angle)*radius,y:5+(i%13)*4,z:Math.cos(angle)*radius});Object.assign(c.prev,c.pos);c.born=-10;c.energy=.5;c.size=1+(i%7)*.22;
 }
 for(const c of model.creatures)if(c.kind==='hopper'){
  c.pebble.stand=1;c.pebble.prevStand=1;
  c.feet=[-1,1].map(side=>{const p={x:c.pos.x-.4,y:c.pos.y-1,z:c.pos.z+side*c.size};return{pos:p,prev:{...p}};});
 }
 const group=model.groups.get('pebbles');group.stones=Array.from({length:20},(_,i)=>({pos:{x:Math.sin(i*2.4)*90,y:1,z:Math.cos(i*2.4)*90},yaw:i,pitch:.1,bank:.1,size:1+i%3,phase:i}));
 const meshes=new FaunaMeshes(scene,shared),control=new FaunaMeshes(scene,shared),mirrors=[];
 for(const sea of [false,true]){
  const mirror=new Reflector(new THREE.PlaneGeometry(sea?1000:90,sea?1000:75),{textureWidth:256,textureHeight:256,multisample:0});
  if(sea){mirror.rotation.x=-Math.PI/2;mirror.position.y=-2;}else{mirror.position.set(0,35,-40);}
  const draw=mirror.onBeforeRender;mirror.onBeforeRender=function(r,s,c,...rest){if(c!==camera)return;const hidden=mirrors.filter(m=>m!==this).map(m=>[m,m.visible]);try{for(const[m]of hidden)m.visible=false;return draw.call(this,r,s,c,...rest)}finally{for(const[m,v]of hidden)m.visible=v}};scene.add(mirror);mirrors.push(mirror);
 }
 const target=new THREE.WebGLRenderTarget(360,240),rows=[];
 try{
  for(const aspect of [1.5,.55])for(const yaw of [0,.5,1.5,3,4.5,5.5]){
   camera.aspect=aspect;camera.updateProjectionMatrix();camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(yaw)*100,-15,-Math.cos(yaw)*100)));camera.updateMatrixWorld();
   const pixels=[],counts=[];
   model.time+=1/30;
   for(const cull of [false,true]){
    const current=cull?meshes:control;
    current.cullLumen=cull;current.pebbles.cull=cull;current.update(model,1,1/30);
    meshes.root.visible=cull;control.root.visible=!cull;
    renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
    const image=new Uint8Array(360*240*4);renderer.readRenderTargetPixels(target,0,0,360,240,image);pixels.push(image);counts.push({lumen:current.root.userData.population.lumen,pebbles:current.pebbles.bodies.count,stones:current.pebbles.stones.count});
   }
   for(const [creature,motion]of control.pebbles.eyes.motion){
    const actual=meshes.pebbles.eyes.motion.get(creature);
    if(JSON.stringify(actual)!==JSON.stringify(motion))throw Error('Culling changed eye-spring continuity');
   }
   let max=0,different=0,lit=0;for(let i=0;i<pixels[0].length;i++){if(i%4===3)continue;const d=Math.abs(pixels[0][i]-pixels[1][i]);max=Math.max(max,d);if(d)different++;if(pixels[0][i])lit++;}
   rows.push({aspect,yaw,full:counts[0],culled:counts[1],max,different,lit});
   if(max>1)throw Error('Visible fauna/reflection changed: '+JSON.stringify(rows.at(-1)));
  }
  if(!rows.some(r=>r.culled.lumen<r.full.lumen*.75))throw Error('Fixture did not exercise substantial culling');
  if(!rows.some(r=>r.culled.pebbles<r.full.pebbles))throw Error('Fixture did not exercise pebble culling');
  if(!rows.some(r=>r.culled.stones<r.full.stones))throw Error('Fixture did not exercise stone culling');
  return rows;
 }finally{renderer.setRenderTarget(null);target.dispose();for(const mirror of mirrors)mirror.dispose();renderer.dispose();}
}
