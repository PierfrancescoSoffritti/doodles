import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const THREE=await import('three'),{MobilePointLights}=await import('../../js/fx/MobilePointLights.js?v=stable-30-3');
function setup(){const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();const sources=Array.from({length:8},(_,i)=>{const l=new THREE.PointLight(0xffbb77,3,100,1.8);l.position.x=10+i*30;scene.add(l);return l;});const pool=new MobilePointLights(scene);return{scene,camera,sources,pool};}
const visibleLightCount=(scene,camera)=>{let n=0;scene.traverseVisible(o=>{if(o.isPointLight&&o.layers.test(camera.layers))n++;});return n;};

test('a fixed shader pool retains nearby source lighting and never changes light count during travel',()=>{
 const {scene,camera,sources,pool}=setup();pool.update(camera,1);pool.update(camera,1);
 assert.equal(visibleLightCount(scene,camera),4);
 assert.deepEqual(new Set(pool.slots.map(s=>s.owner)),new Set(sources.slice(0,4)));
 for(const s of pool.slots){assert.equal(s.light.intensity,s.owner.intensity);assert.deepEqual(s.light.color,s.owner.color);assert.equal(s.light.distance,s.owner.distance);assert.equal(s.light.decay,s.owner.decay);}
 camera.position.x=200;
 for(let i=0;i<30;i++){const before=pool.slots.map(s=>({owner:s.owner,weight:s.weight}));pool.update(camera,1/60);assert.equal(visibleLightCount(scene,camera),4);for(let j=0;j<4;j++)if(before[j].owner!==pool.slots[j].owner)assert.equal(pool.slots[j].weight,0);}
 assert.ok(pool.slots.some(s=>s.owner===sources.at(-1)));
});

test('hidden or removed sources leave smoothly and disposal restores source layers',()=>{
 const {scene,camera,sources,pool}=setup();sources[0].layers.mask=3;pool.update(camera,1);pool.update(camera,1);
 const parent=new THREE.Group();scene.add(parent);parent.add(sources[0]);parent.visible=false;
 sources[1].removeFromParent();pool.update(camera,.05);assert.equal(sources[1].layers.mask,1);
 for(let i=0;i<20;i++)pool.update(camera,1/60);
 assert.ok(pool.slots.every(s=>s.owner!==sources[0]&&s.owner!==sources[1]));
 pool.dispose();assert.equal(sources[0].layers.mask,3);assert.ok(pool.slots.every(s=>!s.light.parent));assert.equal(sources[0].intensity,3);
});

test('ordinary updates reuse registered lights without traversing hidden rigs',()=>{
 const {scene,camera,pool}=setup();pool.update(camera,1);const traverse=scene.traverse;
 scene.traverse=()=>assert.fail('Steady frames must not scan the scene graph');
 for(let i=0;i<60;i++)pool.update(camera,1/30);
 scene.traverse=traverse;
 const added=new THREE.PointLight(0xffffff,10,100,2);scene.add(added);pool.discover();
 for(let i=0;i<30;i++)pool.update(camera,1/30);
 assert.ok(pool.slots.some(s=>s.owner===added));assert.equal(added.layers.mask,0);
 pool.dispose();assert.equal(added.layers.mask,1);
});
