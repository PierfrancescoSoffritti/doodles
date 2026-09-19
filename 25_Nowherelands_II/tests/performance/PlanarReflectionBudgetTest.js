import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const T=await import('three'),{PlanarReflectionBudget}=await import('../../js/fx/PlanarReflectionBudget.js');
function setup(){const camera=new T.PerspectiveCamera(66,1,.8,10000);camera.updateMatrixWorld();const shared={camera,time:1};const renderer={getDrawingBufferSize:v=>v.set(336,612)};const budget=new PlanarReflectionBudget(shared,{mobile:true});const make=()=>{const m=new T.Mesh(new T.CircleGeometry(3)),target={width:384,setSize(w,h){this.width=w;this.height=h;}};m.position.z=-150;m.updateMatrixWorld();m.getRenderTarget=()=>target;return m;};return{camera,shared,renderer,budget,a:make(),b:make()};}
test('mirrors share one capture per frame and alternate at their presentation rate',t=>{
 let now=0;t.mock.method(performance,'now',()=>now);const f=setup(),seen=[],render=function(){seen.push(this);};
 const capture=m=>f.budget.capture(m,render,f.renderer,{},f.camera);
 capture(f.a);capture(f.b);assert.deepEqual(seen,[f.a]);assert.equal(f.a.getRenderTarget().width,64);
 now=1000/30;f.shared.time++;capture(f.a);capture(f.b);assert.deepEqual(seen,[f.a,f.b]);
 now=2000/30;f.shared.time++;capture(f.a);capture(f.b);assert.deepEqual(seen,[f.a,f.b]);
 now=200;f.shared.time++;capture(f.a);capture(f.b);assert.deepEqual(seen,[f.a,f.b,f.a]);
 f.shared.time++;f.budget.capture(f.b,render,f.renderer,{},f.camera.clone());assert.equal(seen.length,3);
 f.a.geometry.dispose();f.b.geometry.dispose();
});
test('a close mirror scales up within the mobile cap and a small size change does not churn targets',t=>{
 let now=0;t.mock.method(performance,'now',()=>now);const f=setup(),capture=()=>f.budget.capture(f.a,()=>{},f.renderer,{},f.camera);
 capture();f.a.position.z=-10;f.a.updateMatrixWorld();f.shared.time++;now=100;capture();assert.equal(f.a.getRenderTarget().width,256);
 f.a.position.z=-25;f.a.updateMatrixWorld();f.shared.time++;now=200;capture();assert.equal(f.a.getRenderTarget().width,256);
 f.a.position.z=-150;f.a.updateMatrixWorld();f.shared.time++;now=400;capture();assert.equal(f.a.getRenderTarget().width,64);
 f.a.geometry.dispose();f.b.geometry.dispose();
});

test('nearby desktop mirrors retain full-rate captures for both visible mirrors',t=>{
 let now=0;t.mock.method(performance,'now',()=>now);const f=setup();f.budget=new PlanarReflectionBudget(f.shared);let captures=0;
 for(const mirror of [f.a,f.b]){mirror.position.z=-10;mirror.updateMatrixWorld();f.budget.capture(mirror,()=>captures++,f.renderer,{},f.camera);}
 assert.equal(captures,2);now=10;f.shared.time++;f.budget.capture(f.a,()=>captures++,f.renderer,{},f.camera);assert.equal(captures,3);
 f.a.geometry.dispose();f.b.geometry.dispose();
});
test('deferred mirrors retain their first image and refresh only the latest visible view',t=>{
 let now=0;t.mock.method(performance,'now',()=>now);const f=setup();f.budget.defer=true;let captures=0;
 const render=()=>captures++,capture=()=>f.budget.capture(f.a,render,f.renderer,{},f.camera);
 capture();assert.equal(captures,1);
 now=220;f.shared.time++;capture();assert.equal(captures,1);
 assert.equal(f.budget.flush(f.renderer,{},f.camera),true);assert.equal(captures,2);
 now=450;f.shared.time++;capture();f.shared.time++;
 assert.equal(f.budget.flush(f.renderer,{},f.camera),false);assert.equal(captures,2);
 capture();assert.equal(f.budget.flush(f.renderer,{},f.camera),true);assert.equal(captures,3);
 assert.equal(f.budget.pending.size,0);f.a.geometry.dispose();f.b.geometry.dispose();
});
