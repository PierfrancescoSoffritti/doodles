import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const THREE=await import('three');const {Fireflies}=await import('../../js/world/Fireflies.js?v=stable-30-3');
test('stationary clusters retain exact motion without repeating fixed terrain samples',()=>{
 let samples=0;const hm={waterLevel:0,height(x,z){samples++;this._water=this.waterLevel;return x*.01+z*.02;}};
 const f=new Fireflies(new THREE.Scene(),hm,{});f.items=f.items.slice(0,4);for(const item of f.items)item.ambient=false;f.rebuild();
 const renderer={getPixelRatio:()=>1},player={x:0,y:0,z:0};
 for(let i=0;i<120;i++){
  const time=i/30;f.update(time,1/30,player,renderer);
  for(let j=0;j<f.items.length;j++){const item=f.items[j],y=Math.max(item.x*.01+item.z*.02,hm.waterLevel)+2.5+item.size*2+Math.sin(time*.9+item.phase)*1.8;assert.equal(f.positions[j*3+1],Math.fround(y));}
 }
 assert.equal(samples,4);hm.waterLevel=20;f.update(4,1/30,player,renderer);assert.equal(samples,8);assert.ok(f.items.every(item=>item.waterY===20));
});
test('ambient motes retain the original staggered terrain sampling cadence',()=>{
 let samples=0;const hm={waterLevel:0,height(){samples++;this._water=0;return 5;}};
 const f=new Fireflies(new THREE.Scene(),hm,{}),player={x:0,y:0,z:0},renderer={getPixelRatio:()=>1};
 f.update(0,0,player,renderer);assert.equal(samples,260);samples=0;
 for(let i=1;i<=4;i++)f.update(i/30,1/30,player,renderer);
 assert.equal(samples,260);assert.ok(f.positions.every(Number.isFinite));
});
