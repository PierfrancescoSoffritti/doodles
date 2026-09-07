import * as THREE from 'three';
import { caveLightingGlsl } from '../caves/CaveLighting.js';

// Each instance carries its own floor exposure: the camera can be outside while
// a pebble is deep underground. Outdoor fog must not illuminate cave bodies.
export function pebbleLighting(mesh, shared, albedo, normal) {
 const material = mesh.material;
 material.uniforms.uPebbleLamp = { value: 0 };
 material.vertexShader = 'attribute vec2 aCaveLight; varying vec2 vCaveLight;\n' + material.vertexShader.replace('void main(){', 'void main(){vCaveLight=aCaveLight;');
 material.fragmentShader = 'varying vec2 vCaveLight; uniform float uPebbleLamp;\n' + caveLightingGlsl + material.fragmentShader;
 material.fragmentShader = material.fragmentShader.replace(/gl_FragColor\s*=\s*vec4\(([^;]+)\);/, (output) => `${output}
 if(vCaveLight.x>.5){
  vec3 caveColor=caveLighting(${albedo},vWorldPos,${normal},vCaveLight.y,uPebbleLamp,cameraPosition);
  float exposure=smoothstep(.12,.7,vCaveLight.y);
  gl_FragColor.rgb=mix(caveColor,gl_FragColor.rgb,exposure);
 }`);
 mesh.geometry.setAttribute('aCaveLight', new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 2), 2).setUsage(THREE.DynamicDrawUsage));
 mesh.onBeforeRender = () => { material.uniforms.uPebbleLamp.value = shared.caveAmount || 0; };
}

export function setPebbleLight(mesh, index, floor) {
 mesh.geometry.attributes.aCaveLight.setXY(index, floor?.cave ? 1 : 0, floor?.daylight || 0);
}
