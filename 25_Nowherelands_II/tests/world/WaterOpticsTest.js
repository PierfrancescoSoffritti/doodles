import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return {url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const THREE=await import('three');
const {WaterOptics}=await import('../../js/world/WaterOptics.js');
test('water snapshots opaque color and depth once per frame and restores its render target',()=>{
 const camera=new THREE.PerspectiveCamera(66,1,.8,1000),shared={camera},uniforms={uSceneColor:{},uSceneDepth:{},uHasScene:{},uHasSceneDepth:{},uResolution:{value:new THREE.Vector2()},uInvProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()}};
 const target=new THREE.WebGLRenderTarget(64,64,{depthTexture:new THREE.DepthTexture(64,64)}),events=[];
 const renderer={getRenderTarget:()=>target,copyFramebufferToTexture:t=>events.push('color'),initRenderTarget:t=>events.push('init'),copyTextureToTexture:(a,b)=>{assert.equal(a,target.depthTexture);assert.notEqual(a,b);events.push('depth');},setRenderTarget:t=>{assert.equal(t,target);events.push('restore');}};
 const optics=new WaterOptics(shared,uniforms);optics.capture(renderer,null,new THREE.PerspectiveCamera());assert.equal(events.length,0);
 optics.capture(renderer,null,camera);optics.capture(renderer,null,camera);assert.deepEqual(events,['color','init','depth','restore']);
 assert.equal(uniforms.uHasSceneDepth.value,1);
 let oldReleased=false;optics.depthTarget.addEventListener('dispose',()=>oldReleased=true);target.setSize(128,96);optics.beginFrame();optics.capture(renderer,null,camera);
 assert.ok(oldReleased);assert.deepEqual(uniforms.uResolution.value.toArray(),[128,96]);assert.equal(optics.depthTarget.width,128);
 optics.dispose();assert.equal(optics.depthTarget,null);target.dispose();
});
test('reconstructed object depth gives a near-surface fish a shorter absorption path than a deep bed',()=>{
 const camera=new THREE.PerspectiveCamera(66,1,.8,1000);camera.position.set(0,30,25);camera.lookAt(0,10,0);camera.updateMatrixWorld(true);
 const restore=p=>{const screen=p.clone().project(camera),view=new THREE.Vector4(screen.x,screen.y,screen.z,1).applyMatrix4(camera.projectionMatrixInverse);view.divideScalar(view.w);return new THREE.Vector3(view.x,view.y,view.z).applyMatrix4(camera.matrixWorld);};
 const fish=restore(new THREE.Vector3(0,9,0)),bed=restore(new THREE.Vector3(0,-20,0));
 assert.ok(Math.abs(fish.y-9)<1e-9);assert.ok(Math.exp(-.32*(10-fish.y))>Math.exp(-.32*(10-bed.y))*1000);
});
