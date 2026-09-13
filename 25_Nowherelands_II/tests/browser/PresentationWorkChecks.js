import * as THREE from 'three';
import { ReplyOutlinePass } from '../../js/fx/ReplyOutlinePass.js?v=stable-30-3';
import { ReplyOutlinePass as BaselineOutline } from '../../js/fx/ReplyOutlinePass.js?v=stable-30-3';
import { Clouds as BaselineClouds } from '../../js/world/Clouds.js?v=stable-30-3';
import { replyOutline } from '../../js/world/fauna/ReplyOutline.js?v=outline-2';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
export const summarize = values => {
 const sorted = values.slice().sort((a,b) => a-b);
 return { n: sorted.length, mean: sorted.reduce((a,b) => a+b,0)/sorted.length, p50: sorted[Math.floor(sorted.length*.5)], p95: sorted[Math.floor(sorted.length*.95)] };
};
function difference(a,b) {
 let channels=0,max=0,squares=0;
 for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);if(delta)channels++;max=Math.max(max,delta);squares+=delta*delta;}
 return {channels,max,rms:Math.sqrt(squares/a.length)};
}
function read(renderer,target) {
 const data=new Uint8Array(target.width*target.height*4);
 renderer.readRenderTargetPixels(target,0,0,target.width,target.height,data);return data;
}

// Paired ABBA blocks, no synchronous readback in the measured section. Query
// results are polled on later callbacks and invalid GPU clocks fail the audit.
export async function pairedCost(renderer, variants, frames=40, blocks=['before','after','after','before']) {
 const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 assert(ext,'GPU timer extension unavailable');
 const data={before:{cpu:[],gpu:[]},after:{cpu:[],gpu:[]}},pending=[];
 const poll=()=>{
  assert(!gl.getParameter(ext.GPU_DISJOINT_EXT),'Disjoint GPU timer');
  while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
   const {query,variant}=pending.shift();data[variant].gpu.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);
  }
 };
 for(const render of Object.values(variants))for(let i=0;i<12;i++){await nextFrame();render();}
 for(const variant of blocks)for(let i=0;i<frames;i++){
  await nextFrame();poll();const query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
  const start=performance.now();variants[variant]();data[variant].cpu.push(performance.now()-start);
  gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,variant});
 }
 for(let i=0;pending.length&&i<180;i++){await nextFrame();poll();}
 assert(!pending.length,'GPU query timeout');
 return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([metric,samples])=>[metric,summarize(samples)]))]));
}

export async function outlineChecks() {
 const renderer=new THREE.WebGLRenderer({antialias:false});
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(0,1,1,0,.1,10);camera.position.z=2;
 const before=new BaselineOutline(),after=new ReplyOutlinePass(),output=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
 const parts=[];
 for(let i=0;i<8;i++){
  const source=new THREE.ShaderMaterial({uniforms:{uBend:{value:0}},vertexShader:`uniform float uBend;void main(){vec3 p=position;p.x+=sin(p.y*19.)*uBend;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:'void main(){gl_FragColor=vec4(1.);}'});
  const mesh=new THREE.Mesh(i%2?new THREE.CircleGeometry(.5,48):new THREE.PlaneGeometry(1,1,1,24),source);
  const signal={value:1},echo={value:new THREE.Vector2(.4,0)};
  replyOutline(mesh,{signal,echo});scene.add(mesh);parts.push({mesh,signal,echo});
 }
 const draw=pass=>{
  renderer.setRenderTarget(output);renderer.setClearColor(0,1);renderer.clear();
  const layers=camera.layers.mask,background=scene.background,autoClear=renderer.autoClear;
  pass.render(renderer,scene,camera);
  assert(renderer.getRenderTarget()===output&&camera.layers.mask===layers&&scene.background===background&&renderer.autoClear===autoClear&&renderer.getClearAlpha()===1,'Outline pass leaked renderer/scene state');
 };
 const cases=[],costs=[];
 try {
  for(const [width,height,dpr] of [[321,197,1],[321,197,1.75],[800,500,1],[800,500,1.75],[1440,900,1.75]]){
   renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);output.setSize(Math.floor(width*dpr),Math.floor(height*dpr));
   for(const scenario of ['empty','small','edges','tile-boundaries','overlap','filled'])for(const progress of [.08,.38,.8]){
    for(let i=0;i<parts.length;i++){
     const {mesh,signal,echo}=parts[i];mesh.visible=scenario!=='empty'&&(scenario!=='small'||i===0);
     mesh.position.set(.5,.5,0);mesh.scale.set(.035,.08,1);mesh.rotation.z=i*.19;
     mesh.material.uniforms.uBend.value=.13;
     if(scenario==='edges')mesh.position.set(i<4?(i%2?1:0):.2+(i-4)*.2,i<4?.2+i*.2:i%2?1:0,0);
     if(scenario==='tile-boundaries')mesh.position.set((16*(i+5)+.25)/width,(16*(i+3)-.25)/height,0);
     if(scenario==='overlap')mesh.position.set(.47+i*.006,.47+i*.008,0);
     if(scenario==='filled'){mesh.position.set(.15+(i%4)*.23,.3+Math.floor(i/4)*.4,0);mesh.scale.set(.21,.35,1);}
     signal.value=i%3===0?.009:i%3===1?.011:1; // exercise the mask's discard threshold
     if(scenario==='small')signal.value=1;
     echo.value.set(progress,i%2);
    }
    draw(before);const a=read(renderer,output);draw(before);const control=difference(a,read(renderer,output));
    draw(after);const diff=difference(a,read(renderer,output));
    const colored=a.reduce((n,v,i)=>n+(i%4===0&&v>0),0);
    assert(diff.channels<=control.channels&&diff.max<=control.max,`Outline pixels differ: ${width} ${dpr} ${scenario} ${progress}: ${JSON.stringify(diff)}`);
    assert(scenario==='empty'||colored>0,`Fixture produced no outline: ${scenario}`);
    cases.push({width,height,dpr,scenario,progress,outlinePixels:colored,control,difference:diff});
   }
   if(width>=800){
    for(const density of ['small','filled']){
     parts.forEach(({mesh,signal,echo},i)=>{mesh.visible=i===0;mesh.position.set(.5,.5,0);mesh.scale.setScalar(density==='small'?.07:3);signal.value=1;echo.value.set(.4,1);});
     costs.push({width,height,dpr,density,...await pairedCost(renderer,{before:()=>draw(before),after:()=>draw(after)})});
    }
   }
  }
  return {cases,costs};
 } finally {before.dispose();after.dispose();output.dispose();parts.forEach(({mesh})=>{mesh.geometry.dispose();mesh.material.dispose();});renderer.dispose();}
}

export async function cloudChecks(d=window.__debug) {
 const c=d.sky.clouds,r=d.renderer,u=c.uniforms,oldRender=r.render,oldPosition=d.camera.position.clone(),oldRotation=d.camera.rotation.clone();
 const oldCover=d.shared.state.cloudCover;
 const original=new BaselineClouds(new THREE.Group(),d.shared);
 const weatherMap=u.uWeatherMap.value,weatherPrevious=u.uWeatherPrevious.value,weatherBlend=u.uWeatherBlend.value;
 const fixture=new THREE.DataTexture(new Uint8Array(4),1,1);fixture.needsUpdate=true;
 u.uWeatherMap.value=u.uWeatherPrevious.value=fixture;u.uWeatherBlend.value=1;
 let captures=0;
 r.render=function(scene,...args){if(scene===c.passScene)captures++;return oldRender.call(this,scene,...args);};
 const results=[];
 try {
  for(const cover of [0,.6,1])for(const yaw of [0,1.4,3.1]){
   fixture.image.data.set([Math.round(cover*255),0,cover===1?255:0,0]);fixture.needsUpdate=true;d.shared.state.cloudCover=cover;d.camera.rotation.set(.3,yaw,0);d.camera.position.copy(oldPosition);
   original.update(100,1/120,d.shared,.8);const a=read(r,original.target);
   c.update(100,1/120,d.shared,.8,true);const control=difference(a,read(r,c.target));
   const count=captures;
   for(let i=0;i<3;i++){d.camera.position.x+=20;c.update(100+i,1/120,d.shared,.8,false);}
   assert(captures===count,'Cloud render occurred on an undisplayed frame');
   d.camera.position.copy(oldPosition);c.update(100,1/120,d.shared,.8,true);
   const diff=difference(a,read(r,c.target));assert(diff.max<=control.max&&diff.channels<=control.channels,'Cloud image changed');
   results.push({cover,yaw,skippedCaptures:3,control,difference:diff});
  }
  const variants={before:()=>{for(let i=0;i<4;i++)original.update(100,1/120,d.shared,.8);},after:()=>{for(let i=0;i<4;i++)c.update(100,1/120,d.shared,.8,i===3);}};
  const cost=await pairedCost(r,variants);
  return {cases:results,cost,description:'Four callbacks per presentation: 120Hz callbacks / 30fps cap; cloud pass only.'};
 }finally{u.uWeatherMap.value=weatherMap;u.uWeatherPrevious.value=weatherPrevious;u.uWeatherBlend.value=weatherBlend;fixture.dispose();original.target.dispose();original.mesh.geometry.dispose();original.mesh.material.dispose();original.passScene.children[0].geometry.dispose();original.passScene.children[0].material.dispose();r.render=oldRender;d.camera.position.copy(oldPosition);d.camera.rotation.copy(oldRotation);d.shared.state.cloudCover=oldCover;c.update(d.shared.time,0,d.shared,d.shared.skyDim,true);}
}

// Test real scene masks, including original shader deformation and instancing.
export async function sceneOutlineChecks(d=window.__debug) {
 const before=new BaselineOutline(),after=new ReplyOutlinePass(),r=d.renderer;
 const reflection=d.water.far.onBeforeRender;
 const size=r.getDrawingBufferSize(new THREE.Vector2()),output=new THREE.WebGLRenderTarget(size.x,size.y,{depthBuffer:false});
 const draw=pass=>{r.setRenderTarget(output);r.setClearColor('#172332',1);r.clear();pass.render(r,d.scene,d.camera);};
 try{
  draw(before);const a=read(r,output);draw(before);const control=difference(a,read(r,output));draw(after);const diff=difference(a,read(r,output));
  const mask=read(r,after.mask);let occupied=0;for(let i=0;i<mask.length;i+=4)if(mask[i]>2)occupied++;
  assert(occupied>0,'No responding creature appeared in the real scene mask');
  assert(diff.max<=control.max&&diff.channels<=control.channels,'Real creature outline pixels changed');
  const cost=await pairedCost(r,{before:()=>draw(before),after:()=>draw(after)});
  // Hold the already-captured sea reflection fixed in both variants. This measures
  // the complete main-view render without giving either variant extra captures.
  d.water.far.onBeforeRender=()=>{};
  const frame=pass=>{r.setRenderTarget(null);d.post.render(d.shared.time,d.shared);pass.render(r,d.scene,d.camera);};
  const pixels=()=>{const data=new Uint8Array(size.x*size.y*4);r.getContext().readPixels(0,0,size.x,size.y,r.getContext().RGBA,r.getContext().UNSIGNED_BYTE,data);return data;};
  frame(before);frame(before);frame(before);const fullBefore=pixels();frame(before);const fullControl=difference(fullBefore,pixels());frame(after);const fullDifference=difference(fullBefore,pixels());
  assert(fullDifference.channels<=fullControl.channels&&fullDifference.max<=fullControl.max,'Full scene composite changed');
  const alternating=Array.from({length:60},()=>['before','after','after','before']).flat();
  const fullFrameControl=await pairedCost(r,{before:()=>frame(before),after:()=>frame(before)},1,alternating);
  const fullFrameCost=await pairedCost(r,{before:()=>frame(before),after:()=>frame(after)},1,alternating);
  frame(after);
  const image=r.domElement.toDataURL('image/png');
  return {maskPixels:occupied,control,difference:diff,cost,fullControl,fullDifference,fullFrameControl,fullFrameCost,image};
 }finally{d.water.far.onBeforeRender=reflection;r.setRenderTarget(null);before.dispose();after.dispose();output.dispose();}
}

export function installLiveAudit(d=window.__debug) {
 const gl=d.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 assert(ext,'GPU timer extension unavailable');
 const oldCloud=d.sky.clouds.update;
 d.sky.clouds.update=function(...args){if(window.__cloudBaseline)args[4]=true;return oldCloud.apply(this,args);};
 const watch=(object,method,label,predicate=()=>true)=>{
  const original=object[method];object[method]=function(...args){if(window.__liveMetrics&&predicate(...args))window.__liveMetrics[label]++;return original.apply(this,args);};
 };
 watch(d.renderer,'render','cloudCaptures',scene=>scene===d.sky.clouds.passScene);
 watch(d.player,'update','world');watch(d.shared.conductor,'update','music');watch(d.shared.audio,'update','engine');watch(d.post,'render','presentations');
 const pending=[];let query=null,start=0,last=0;
 const poll=()=>{
  assert(!gl.getParameter(ext.GPU_DISJOINT_EXT),'Live GPU clock became disjoint');
  while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
   const {query,metrics}=pending.shift();metrics.gpu.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);
  }
 };
 window.__presentationFrameBegin=()=>{
  poll();const m=window.__liveMetrics;if(!m)return;
  const now=performance.now();if(last)m.intervals.push(now-last);last=now;
  m.callbacks++;query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);start=performance.now();
 };
 window.__presentationFrameEnd=()=>{
  const m=window.__liveMetrics;if(!m||!query)return;
  m.cpu.push(performance.now()-start);gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,metrics:m});query=null;
 };
 return {
  begin(before,fps){window.__cloudBaseline=before;d.hud.frameRate=fps;d.pacer.reset();last=0;window.__liveMetrics={callbacks:0,world:0,music:0,engine:0,presentations:0,cloudCaptures:0,intervals:[],cpu:[],gpu:[]};},
  async end(){const m=window.__liveMetrics;window.__liveMetrics=null;for(let i=0;pending.length&&i<180;i++){await nextFrame();poll();}assert(!pending.length,'Live GPU queries timed out');
   assert(m.world===m.callbacks&&m.music===m.callbacks&&m.engine===m.callbacks,'Presentation gating changed world/music cadence');
   assert(m.cloudCaptures===(window.__cloudBaseline?m.callbacks:m.presentations),'Unexpected cloud capture count');
   return {...m,intervals:summarize(m.intervals),cpu:summarize(m.cpu),gpu:summarize(m.gpu)};
  }
 };
}
