import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const T=await import('three'),{StablePointLights}=await import('../../js/fx/StablePointLights.js');
test('desktop light slots preserve every source and remain present across visibility changes',()=>{
 const scene=new T.Scene(),parent=new T.Group(),source=new T.PointLight('#ff6ad5',7,120,1.8);parent.position.set(10,20,30);source.position.set(1,2,3);parent.add(source);scene.add(parent);
 const lights=new StablePointLights(scene);lights.update();const copy=lights.slots[0].light;
 assert.equal(source.layers.mask,0);assert.equal(copy.layers.mask,1);assert.deepEqual(copy.position.toArray(),[11,22,33]);assert.deepEqual(copy.color,source.color);assert.equal(copy.intensity,7);assert.equal(copy.distance,120);assert.equal(copy.decay,1.8);
 parent.visible=false;lights.update();assert.equal(copy.intensity,0);assert.equal(copy.visible,true);assert.equal(copy.parent,scene);
 parent.visible=true;source.intensity=13;lights.update();assert.equal(copy.intensity,13);
 lights.dispose();assert.equal(source.layers.mask,1);assert.equal(copy.parent,null);assert.equal(scene.children.length,1);
});
