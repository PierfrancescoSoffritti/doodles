import * as THREE from 'three';

// Every authored desktop light keeps its color, range, intensity and position.
// Root-level shader slots survive helper visibility changes during reflections,
// so hiding a mirror or entering a cave cannot compile a new lighting layout.
export class StablePointLights {
 constructor(scene){
  this.scene=scene;this.sources=new Map();this.slots=[];
  scene.traverse(source=>{if(source.isPointLight)this.sources.set(source,source.layers.mask);});
  for(const [source,mask] of this.sources){
   const light=new THREE.PointLight();light.layers.mask=mask;light.name='Stable '+source.name;scene.add(light);
   this.slots.push({source,light});source.layers.mask=0;
  }
 }
 // All world lights are created before this layout. Streamed mites use emissive
 // bodies and reuse their existing colony light rather than adding new lights.
 discover(){}
 update(){
  for(const {source,light} of this.slots){
   let visible=true,attached=false;for(let p=source;p;p=p.parent){if(!p.visible)visible=false;if(p===this.scene)attached=true;}
   source.getWorldPosition(light.position);light.color.copy(source.color);
   light.intensity=visible&&attached?source.intensity:0;light.distance=source.distance;light.decay=source.decay;
  }
 }
 dispose(){for(const [source,mask] of this.sources)source.layers.mask=mask;for(const {light} of this.slots)light.removeFromParent();this.sources.clear();this.slots=[];}
}
