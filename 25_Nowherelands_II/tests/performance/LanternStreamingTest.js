import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){
 if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};
 if(s.startsWith('three/addons/'))return{url:new URL('../../../common/libs/three-0.185/examples/jsm/'+s.slice(13),import.meta.url).href,shortCircuit:true};
 return next(s,c);
}});
globalThis.location={search:'?seed=stream'};globalThis.matchMedia=()=>({matches:false});
globalThis.document={hidden:false,createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
const THREE=await import('three');
const {WorldLanternMites}=await import('../../js/world/fauna/WorldLanternMites.js?v=stable-30-22');
const {lanternBarkSite,lanternHollowSite}=await import('../../js/world/fauna/LanternMiteHabitat.js?v=stable-30-3');
const sample=()=>({ground:0,water:-5,slope:0,forest:.7,wet:.5,coast:0,roof:false});
function setup(){
 const host={id:'stream-tree',x:0,y:0,z:0,radius:8};
 const site=lanternHollowSite(lanternBarkSite(host,sample,x=>Math.sqrt(100-x*x),'staged',.7),sample);
 const renderer={target:null,compiles:0,uploads:0,getRenderTarget(){return this.target},getActiveCubeFace(){return 0},getActiveMipmapLevel(){return 0},setRenderTarget(t){this.target=t},
  compileAsync(scene){assert.equal(this.target?.texture.type,THREE.HalfFloatType);this.compiledTarget=this.target;this.compiles++;return Promise.resolve(scene)},
  render(){assert.equal(this.target,this.compiledTarget);this.uploads++}};
 const world=Object.assign(Object.create(WorldLanternMites.prototype),{scene:new THREE.Scene(),root:new THREE.Group(),time:10,colonies:new Map(),homeMaterials:{},vegetation:{chunks:new Map()},streamStats:{steps:0,maxStepMs:0,installed:0,cancelled:0},hosts:()=>[host],shared:{renderer,camera:new THREE.PerspectiveCamera(),player:{position:new THREE.Vector3()},colliders:[],fauna:{}}});
 return{world,site,renderer};
}
test('streamed homes compile for the linear scene target and publish colliders with complete meshes',async()=>{
 const {world,site,renderer}=setup(),work=world.prepareColony(site);let steps=0;
 for(;;){const r=work.next();if(r.done)break;steps++;assert.equal(world.root.children.length,0);assert.equal(world.shared.colliders.length,0);if(r.value?.then)await r.value;assert.equal(renderer.target,null);}
 assert.ok(steps>100);assert.equal(renderer.compiles,1);assert.equal(renderer.uploads,1);assert.equal(world.colonies.size,1);assert.equal(world.root.children.length,2);assert.ok(world.shared.colliders.length);assert.equal(world.streamStats.installed,1);
 world.remove([...world.colonies.values()][0]);assert.equal(world.shared.colliders.length,0);world.warmTarget.dispose();
});
test('travel past a pending home cancels it without leaving meshes or collisions',async()=>{
 const {world,site}=setup(),work=world.prepareColony(site);world.hosts=()=>[];
 for(;;){const r=work.next();if(r.done)break;if(r.value?.then)await r.value;}
 assert.equal(world.root.children.length,0);assert.equal(world.shared.colliders.length,0);assert.equal(world.colonies.size,0);assert.equal(world.streamStats.cancelled,1);world.warmTarget.dispose();
});
test('cancellation during geometry work publishes nothing',()=>{
 const {world,site}=setup(),work=world.prepareColony(site);for(let i=0;i<8;i++)work.next();work.return();
 assert.equal(world.root.children.length,0);assert.equal(world.shared.colliders.length,0);assert.equal(world.streamStats.cancelled,1);
});

test('visiting an unloaded colony queues staged work instead of building inside the input handler',()=>{
 const {world}=setup();world.visited=new Set();let queued=0;
 world.stream=()=>{queued++;};world.siteFor=world.add=()=>{throw Error('Visit must not synchronously construct a home');};
 assert.equal(world.visit(),null);assert.equal(queued,1);
 const colony={id:'ready',site:{center:{x:0,z:0}}};world.colonies.set(colony.id,colony);
 assert.equal(world.visit(),colony);assert.equal(world.selected,colony);assert.equal(world.observing,true);assert.ok(world.visited.has(colony.id));assert.equal(queued,1);
});
