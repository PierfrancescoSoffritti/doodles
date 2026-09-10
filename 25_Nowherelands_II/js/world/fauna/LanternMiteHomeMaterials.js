import * as THREE from 'three';

const hollowLight = /* glsl */`
 uniform vec3 uHomeOrigin;
 uniform vec2 uHomeNormal, uHomeTangent;
 uniform float uHomeScale, uHomeGlow;
 vec3 homeLocal(vec3 world) {
  vec3 d=(world-uHomeOrigin)/uHomeScale;
  return vec3(dot(d.xz,uHomeTangent),d.y,dot(d.xz,uHomeNormal));
 }
 float homeWarmth(vec3 world) {
  vec3 p=homeLocal(world);
  return (1.0-smoothstep(0.45,1.35,length(vec2(p.x/4.4,(p.z+0.25)/3.0))))
   * (1.0-smoothstep(3.6,5.0,p.y));
 }
 vec3 homeGlow(vec3 world,vec3 normal) {
  vec3 p=homeLocal(world), delta=vec3(0.0,1.3,0.45)-p;
  vec3 direction=normalize(vec3(uHomeTangent.x*delta.x+uHomeNormal.x*delta.z,delta.y,uHomeTangent.y*delta.x+uHomeNormal.y*delta.z));
  float diffuse=0.28+0.72*max(0.0,dot(normal,direction));
  return vec3(0.14,0.075,0.022)*uHomeGlow*homeWarmth(world)*diffuse/(1.0+dot(delta,delta)*0.4);
 }
`;

// Share the world's live lighting, habitat textures, contours and weather.
// Only the home owns these material instances; it never owns their textures.
export function lanternHomeMaterial(kind, sources = {}, homeUniforms = {}) {
 const original = kind === 2 ? sources.rock : kind >= 3 ? sources.ground : null;
 if (original) {
  const tint=kind===3?'vec3(0.10,0.135,0.05)':kind===4?'vec3(0.10,0.065,0.038)':'vec3(0.19,0.145,0.085)';
  const amount=kind===3?'0.85':kind===4?'0.48':'0.42';
  return new THREE.ShaderMaterial({
   uniforms: {...original.uniforms,...homeUniforms},
   vertexShader: kind === 2 ? original.vertexShader.replace('modelMatrix * instanceMatrix', 'modelMatrix') : original.vertexShader,
   fragmentShader: hollowLight+original.fragmentShader
    .replace('vec3 color = terrainLight(albedo, n)',`albedo=mix(albedo,${tint},homeWarmth(vWorldPos)*${amount});\nvec3 color = terrainLight(albedo, n)`)
    .replace('color = applyFog(color, vWorldPos, uCameraPos);','color += homeGlow(vWorldPos,n)*mix(vec3(0.7),albedo*4.0,0.45);\ncolor = applyFog(color, vWorldPos, uCameraPos);'),
   side: kind >= 3 ? THREE.DoubleSide : THREE.FrontSide,
  });
 }
 // The giants use this linear bark colour and a small violet ambient lift.
 const bark = new THREE.Color().setRGB(0.03,0.02,0.07).multiplyScalar(kind === 1 ? 0.82 : 1);
 const material=new THREE.MeshLambertMaterial({color:bark,emissive:new THREE.Color().setRGB(0.03*0.36,0.02*0.27,0.07*0.6),emissiveIntensity:0.7,flatShading:true});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,homeUniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHomeWorld;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvHomeWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHomeWorld;\n'+hollowLight)
   .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.12,0.07,0.032),homeWarmth(vHomeWorld)*0.8);')
   .replace('#include <opaque_fragment>','outgoingLight += homeGlow(vHomeWorld,inverseTransformDirection(normal,viewMatrix));\n#include <opaque_fragment>');
 };
 material.customProgramCacheKey=()=>`lantern-warm-bark-${kind}`;
 return material;
}

export function lanternBrambleMaterial(source) {
 if (!source) return new THREE.LineBasicMaterial({color:'#443450'});
 return new THREE.ShaderMaterial({uniforms:source.uniforms,vertexShader:source.vertexShader,
  fragmentShader:source.fragmentShader.replace('vec4(col, 1.0)','vec4(col * 0.38, 1.0)'),fog:true});
}
