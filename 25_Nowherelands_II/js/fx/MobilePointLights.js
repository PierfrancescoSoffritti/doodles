import * as THREE from 'three';

// A fixed shader light count avoids recompilation as landmarks enter/leave view.
// Sources keep their own animation; only the four most relevant lights shade
// nearby geometry. Ownership changes fade through zero rather than jumping.
export class MobilePointLights {
 constructor(scene,count=4) {
  this.scene=scene;this.sources=new Map();this.position=new THREE.Vector3();
  this.slots=Array.from({length:count},()=>{const light=new THREE.PointLight(0xffffff,0,1,2);light.name='Mobile local light';scene.add(light);return{light,owner:null,weight:0};});
  this.pool=new Set(this.slots.map(s=>s.light));
 }
 discover() {
  const live=new Set();
  this.scene.traverse(source=>{if(!source.isPointLight||this.pool.has(source))return;live.add(source);if(!this.sources.has(source))this.sources.set(source,source.layers.mask);source.layers.mask=0;});
  for(const [source,mask]of this.sources)if(!live.has(source)){source.layers.mask=mask;this.sources.delete(source);}
 }
 update(camera,dt) {
  this.discover();const candidates=[];
  for(const source of this.sources.keys()){
   let visible=true;for(let parent=source;parent;parent=parent.parent)if(!parent.visible){visible=false;break;}
   if(!visible||source.intensity<=0)continue;
   source.updateWorldMatrix(true,false);source.getWorldPosition(this.position);
   const d2=this.position.distanceToSquared(camera.position),range=source.distance||1000;
   if(d2>(range+500)**2)continue;
   const color=source.color,luminance=.2126*color.r+.7152*color.g+.0722*color.b;
   const retained=this.slots.some(s=>s.owner===source)?1.2:1;
   candidates.push({source,score:retained*source.intensity*luminance/(25+d2)});
  }
  candidates.sort((a,b)=>b.score-a.score);const wanted=new Set(candidates.slice(0,this.slots.length).map(c=>c.source));
  const occupied=new Set(this.slots.map(s=>s.owner));
  for(const slot of this.slots){
   const keep=wanted.has(slot.owner);
   slot.weight=Math.max(0,Math.min(1,slot.weight+(keep?1:-1)*dt*6));
   if(!keep&&slot.weight===0){occupied.delete(slot.owner);slot.owner=candidates.find(c=>wanted.has(c.source)&&!occupied.has(c.source))?.source||null;if(slot.owner)occupied.add(slot.owner);}
   const source=slot.owner,light=slot.light;
   if(!source){light.intensity=0;continue;}
   source.getWorldPosition(light.position);light.color.copy(source.color);light.distance=source.distance;light.decay=source.decay;
   light.intensity=source.intensity*slot.weight;
  }
 }
 dispose(){for(const[source,mask]of this.sources)source.layers.mask=mask;for(const s of this.slots)s.light.removeFromParent();this.sources.clear();}
}
