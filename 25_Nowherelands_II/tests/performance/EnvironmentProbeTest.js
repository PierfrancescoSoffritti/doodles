import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const THREE=await import('three');
const {EnvironmentProbe}=await import('../../js/fx/EnvironmentProbe.js?v=stable-30-3');
globalThis.requestAnimationFrame=callback=>queueMicrotask(callback);
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),initial={name:'main-target'},hidden=new THREE.Mesh();scene.add(hidden);
 const renderer={target:initial,face:2,mip:1,xr:{enabled:true},coordinateSystem:THREE.WebGLCoordinateSystem,
 getRenderTarget(){return this.target},getActiveCubeFace(){return this.face},getActiveMipmapLevel(){return this.mip},setRenderTarget(t,f=0,m=0){this.target=t;this.face=f;this.mip=m},
 render(){assert.equal(hidden.visible,false);assert.equal(this.xr.enabled,false)},async compileAsync(){assert.ok(scene.environment,'compile after the first map is installed');assert.equal(this.target,probe.cube)}};
 const pmrem={fromCubemap(texture,target){return target||{texture:{image:{width:384,height:512}}}}};
 const probe=new EnvironmentProbe(renderer,scene,camera,{fogColor:new THREE.Color(),caveAmount:0},pmrem,()=>[hidden],target=>scene.environment=target.texture);
 return {probe,renderer,initial,hidden};
}
test('loading prepares both the initial and environment-lit shader variants',async()=>{
 const {probe,renderer,initial,hidden}=fixture();await probe.prewarm();
 assert.equal(probe.stats.faces,12);assert.equal(probe.stats.filters,2);assert.equal(probe.face,-1);
 assert.equal(renderer.target,initial);assert.equal(renderer.face,2);assert.equal(renderer.mip,1);assert.equal(renderer.xr.enabled,true);assert.equal(hidden.visible,true);
 probe.update(1,true);assert.equal(probe.stats.cycles,2,'retain the completed lighting until an update is due');
});
test('asynchronous compilation failure restores the active render target',async()=>{
 const {probe,renderer,initial}=fixture();renderer.compileAsync=async()=>{throw Error('compile failed')};
 await assert.rejects(probe.prewarm(),/compile failed/);assert.equal(renderer.target,initial);assert.equal(renderer.face,2);assert.equal(renderer.mip,1);
});
