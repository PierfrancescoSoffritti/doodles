import * as THREE from 'three';

// Small mirrors do not need a full-size world render on every game frame.
// Share the capture budget between standing mirrors and willow pendants.
export class PlanarReflectionBudget {
 constructor(shared,{mobile=false}={}){
  this.shared=shared;this.mobile=mobile;this.interval=1000/(mobile?15:30);
  this.records=new WeakMap();this.lastFrame=-1;this.sphere=new THREE.Sphere();this.point=new THREE.Vector3();this.size=new THREE.Vector2();
  this.stats={captures:0,reused:0};this.pending=new Map();this.defer=false;this.flushing=false;
 }
 capture(reflector,render,renderer,scene,camera,...rest){
  if(camera!==this.shared.camera)return;
  const now=performance.now(),frame=this.shared.time;
  let record=this.records.get(reflector);
  if(!record){record={at:-Infinity,size:0};this.records.set(reflector,record);}
  if(this.mobile&&this.lastFrame===frame){this.stats.reused++;return;}
  const geometry=reflector.geometry;if(!geometry.boundingSphere)geometry.computeBoundingSphere();
  this.sphere.copy(geometry.boundingSphere).applyMatrix4(reflector.matrixWorld);
  this.point.copy(this.sphere.center).applyMatrix4(camera.matrixWorldInverse);
  renderer.getDrawingBufferSize(this.size);
  const pixels=this.sphere.radius*this.size.y/(Math.max(camera.near,-this.point.z)*Math.tan(camera.fov*Math.PI/360));
  const wanted=Math.min(this.mobile?256:512,Math.max(64,2**Math.ceil(Math.log2(Math.max(1,pixels)))));
  // A pendant spanning a few pixels can reuse its reflection longer. Nearby
  // mirrors retain the faster rate; their geometry and interaction always move
  // at the game's full frame rate.
  const interval=this.mobile?Math.max(this.interval,pixels<64?200:pixels<128?100:0):pixels<128?this.interval:0;
  if(now-record.at<interval-1){this.stats.reused++;return;}
  // Keep the first image synchronous. Later mobile captures reuse that image
  // during production and refresh only once the presenter has refilled.
  if(this.mobile&&this.defer&&!this.flushing&&Number.isFinite(record.at)){
   this.pending.set(reflector,{render,rest,frame});this.stats.reused++;return;
  }
  // Hysteresis keeps swaying mirrors from reallocating around a size boundary.
  if(!record.size||wanted>record.size||wanted<record.size/2){reflector.getRenderTarget().setSize(wanted,wanted);record.size=wanted;}
  render.call(reflector,renderer,scene,camera,...rest);
  record.at=now;this.lastFrame=frame;this.stats.captures++;
 }
 flush(renderer,scene,camera){
  let captured=false;
  for(const [reflector,request] of this.pending){
   this.pending.delete(reflector);
   // Only reflectors actually drawn by the most recent main view can refresh.
   if(request.frame!==this.shared.time)continue;
   const before=this.stats.captures;this.flushing=true;
   try{this.capture(reflector,request.render,renderer,scene,camera,...request.rest);}
   finally{this.flushing=false;}
   if(this.stats.captures!==before){captured=true;break;}
  }
  return captured;
 }
}
