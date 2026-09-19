import * as THREE from 'three';
import { noiseGlsl } from './TerrainMaterial.js?v=gate-dark-4';

// vnoise already repeats its integer cell coordinates every 1024 units. Store
// the four original corner hashes together so each octave needs one fetch.
// Generate on the same GPU, in full float precision, without quantizing detail.
export const lookupNoiseGlsl = noiseGlsl
 .replace('float vnoise(vec2 p)', 'uniform highp sampler2D uNoiseLookup;\nfloat vnoise(vec2 p)')
 .replace('return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);',
  'vec4 h = texture2D(uNoiseLookup, (i + 0.5) / 1024.0);\nreturn mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);');

export function createNoiseLookup(renderer) {
 if (!renderer.extensions.has('EXT_color_buffer_float')) return null;
 const target = new THREE.WebGLRenderTarget(1024, 1024, {
  type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  depthBuffer: false, stencilBuffer: false,
 });
 const material = new THREE.RawShaderMaterial({
  depthTest: false, depthWrite: false,
  vertexShader: 'precision highp float;attribute vec3 position;void main(){gl_Position=vec4(position,1.0);}',
  fragmentShader: `precision highp float;${noiseGlsl}
   void main(){vec2 i=floor(gl_FragCoord.xy);gl_FragColor=vec4(hash21(i),hash21(i+vec2(1,0)),hash21(i+vec2(0,1)),hash21(i+vec2(1,1)));}`,
 });
 const geometry = new THREE.PlaneGeometry(2, 2), scene = new THREE.Scene();
 scene.add(new THREE.Mesh(geometry, material));
 const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
 try { renderer.setRenderTarget(target); renderer.render(scene, new THREE.Camera()); }
 finally { renderer.setRenderTarget(previous, face, level); geometry.dispose(); material.dispose(); }
 return target;
}
