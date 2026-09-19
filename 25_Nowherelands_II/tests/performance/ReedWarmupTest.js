import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const T=await import('three'),{WorldReedWalkers}=await import('../../js/world/fauna/WorldReedWalkers.js?v=stable-30-3'),{reedIndividual}=await import('../../js/world/fauna/ReedWalkerTraits.js');
const variant=o=>[o.material.type,o.material.flatShading,o.material.customProgramCacheKey(),o.isInstancedMesh,!!o.instanceColor,o.material.side,o.material.transparent].join('|');
test('loading warmup covers every streamed reed family material and retains the program owners',async()=>{
 const walkers=Object.create(WorldReedWalkers.prototype),world=new T.Scene(),camera=new T.PerspectiveCamera();
 world.add(new T.PointLight(),new T.DirectionalLight());const disabled=new T.PointLight();disabled.layers.mask=0;world.add(disabled);
 const previous={},keys=new Set();let target=previous,draws=0;const owners=new Set(),disposed=new Set();
 const renderer={getRenderTarget:()=>target,getActiveCubeFace:()=>3,getActiveMipmapLevel:()=>2,setRenderTarget:t=>{target=t},async compileAsync(scene,view){assert.equal(scene.children.filter(o=>o.isLight).length,view.layers.mask===1?2:0);scene.traverse(o=>{if(o.isMesh){keys.add(variant(o));if(!owners.has(o.material)){owners.add(o.material);o.material.addEventListener('dispose',()=>disposed.add(o.material));}}});},render(){draws++;assert.notEqual(target,previous);}};
 walkers.shared={scene:world,camera,renderer};await walkers.prewarm();assert.equal(target,previous);assert.equal(draws,2);assert.equal(disposed.size,0);assert.equal(world.children.length,3);
 for(const form of ['reedbed','peat','tarn'])for(const age of ['young','adult','old'])for(const sex of ['male','female']){
  const rig=walkers.createRig({traits:reedIndividual(form,5,age,sex),scale:1});try{rig.root.traverse(o=>{if(o.isMesh)assert.ok(keys.has(variant(o)),`${form}/${age}/${sex}: ${variant(o)}`);});}finally{rig.dispose();}
 }
 walkers.warmup.dispose();assert.equal(disposed.size,owners.size);
});
