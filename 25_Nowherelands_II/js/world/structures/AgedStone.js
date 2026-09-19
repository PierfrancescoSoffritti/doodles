import { STONE_PULSE_COUNT, STONE_PULSE_LIFETIME } from '../../atelier/StructureStudy.js?v=structures-place-4';
import * as THREE from 'three';

// Dark mineral with no organic growth; only player responses emit light.
// Static object-space detail; no textures or additional passes.
export function agedStoneMaterial(){
 const material=new THREE.MeshStandardMaterial({color:'#62636d',roughness:1,flatShading:true});
 const wear={value:1},response={value:new THREE.Vector3(0,0,0)};material.userData.wear=wear;material.userData.response=response;
 const pulses={value:new Float32Array(STONE_PULSE_COUNT).fill(-1)};material.userData.pulses=pulses;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uStonePulses=pulses;shader.uniforms.uStoneWear=wear;shader.uniforms.uStoneResponse=response;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStonePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvStonePosition=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   uniform float uStoneWear;
   uniform vec3 uStoneResponse;
   uniform float uStonePulses[${STONE_PULSE_COUNT}];
   varying vec3 vStonePosition;
   vec4 stoneHash(vec4 n){n=fract(n*.1031);n*=n+33.33;return fract(n*(n+n));}
   float stoneNoise(vec3 p){
    vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    float n=dot(i,vec3(1,157,113));
    vec4 a=stoneHash(n+vec4(0,1,157,158)),b=stoneHash(n+vec4(113,114,270,271));
    vec4 c=mix(a,b,f.z);return mix(mix(c.x,c.y,f.x),mix(c.z,c.w,f.x),f.y);
   }
  `).replace('#include <color_fragment>',`#include <color_fragment>
   vec3 sp=vStonePosition;
   float mineral=stoneNoise(sp*.31+vec3(12,4,9));
   float grit=stoneNoise(sp*2.8);
   float base=1.-smoothstep(3.,14.,sp.y);
   vec3 worn=diffuseColor.rgb*(.76+mineral*.22+grit*.12)*(1.-base*.08);
   // A short angular fracture on the left support, not a band around every face.
   float fault=abs(sp.y-(15.+(sp.x+24.)*.55+abs(sp.x+20.)*.6));
   float crack=(1.-smoothstep(.025,.055+fwidth(fault),fault))*(1.-smoothstep(-18.,-15.,sp.x))*smoothstep(-28.,-24.,sp.x)*smoothstep(.4,.65,mineral);
   worn*=1.-crack*.35;
   diffuseColor.rgb=mix(diffuseColor.rgb,worn,uStoneWear);
   // Subtle mineral relief loses its finest detail as it becomes subpixel.
   float gritFade=1.-smoothstep(.3,1.3,length(fwidth(sp*2.8)));
   float stoneRelief=uStoneWear*(grit*.025*gritFade+mineral*.012);
  `).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float responseBands=0.;
   if(uStoneResponse.z>0.)for(int i=0;i<${STONE_PULSE_COUNT};i++){
    float age=uStonePulses[i];
    if(age>=0.)responseBands+=(1.-smoothstep(1.,3.5,abs(vStonePosition.y-age*90.)))*(1.-smoothstep(.4,${STONE_PULSE_LIFETIME},age));
   }
   totalEmissiveRadiance+=vec3(.12,.24,.32)*(uStoneResponse.x*.24+min(responseBands,1.5)*2.+uStoneResponse.y*.06);
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 stoneDx=dFdx(-vViewPosition),stoneDy=dFdy(-vViewPosition);
   vec3 stoneS=cross(stoneDy,normal),stoneT=cross(normal,stoneDx);
   float stoneDet=dot(stoneDx,stoneS);
   if(abs(stoneDet)>1e-8)normal=normalize(abs(stoneDet)*normal-sign(stoneDet)*(dFdx(stoneRelief)*stoneS+dFdy(stoneRelief)*stoneT));
  `).replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   // Match the world's terrain ambient floor. This enters reflected diffuse
   // light rather than emission, with a restrained floor for the dark stone.
   reflectedLight.indirectDiffuse += uStoneWear*diffuseColor.rgb*vec3(.10,.115,.135);
  `);
 };
 material.customProgramCacheKey=()=> 'responsive-dark-stone-pulses-v2';
 return material;
}
