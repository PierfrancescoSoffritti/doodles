import * as THREE from 'three';
import { createNoiseLookup, lookupNoiseGlsl } from '../../js/world/NoiseLookup.js?v=stable-30-16';
import { noiseGlsl } from '../../js/world/TerrainMaterial.js?v=player-notes-13';

export function checkNoiseLookup() {
 const renderer=new THREE.WebGLRenderer({antialias:false});
 const lookup=createNoiseLookup(renderer);
 if(!lookup){renderer.dispose();return{supported:false};}
 const target=new THREE.WebGLRenderTarget(512,512,{type:THREE.FloatType,depthBuffer:false});
 const material=new THREE.RawShaderMaterial({
  uniforms:{uNoiseLookup:{value:lookup.texture},uEdge:{value:0}},
  vertexShader:'precision highp float;attribute vec3 position;void main(){gl_Position=vec4(position,1.0);}',
  fragmentShader:`precision highp float;uniform float uEdge;
   ${noiseGlsl.replaceAll('hash21','referenceHash').replaceAll('vnoise','referenceNoise').replaceAll('fbm2','referenceFbm')}
   ${lookupNoiseGlsl}
   void main(){
    vec2 p=(gl_FragCoord.xy-vec2(256))*vec2(17.281,19.123)+vec2(.02,.19);
    if(uEdge>0.5)p=(gl_FragCoord.xy-vec2(256))*.0001+vec2(1024,-1024);
    gl_FragColor=vec4(referenceNoise(p)-vnoise(p),referenceFbm(p)-fbm2(p),referenceNoise(p*.037)-vnoise(p*.037),referenceFbm(p*.001)-fbm2(p*.001));
   }`,
 });
 const scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(2,2);scene.add(new THREE.Mesh(geometry,material));
 const pixels=new Float32Array(512*512*4);let changed=0,max=0,samples=0;
 try{
  for(let edge=0;edge<2;edge++){
   material.uniforms.uEdge.value=edge;renderer.setRenderTarget(target);renderer.render(scene,new THREE.Camera());
   renderer.readRenderTargetPixels(target,0,0,512,512,pixels);
   for(const x of pixels){if(x!==0)changed++;max=Math.max(max,Math.abs(x));}samples+=pixels.length;
  }
  return{supported:true,samples,changed,max};
 }finally{renderer.setRenderTarget(null);target.dispose();lookup.dispose();geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}
}
