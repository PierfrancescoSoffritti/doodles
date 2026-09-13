import {UniformsUtils} from 'three';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// Film and output conversion read the same pixel. Combining them avoids an
// intermediate full-resolution render target write/read, while OutputPass
// still owns the renderer's exposure, tone mapping and color-space defines.
export class FilmOutputPass extends OutputPass {
 constructor(filmShader) {
  super();
  Object.assign(this.uniforms,UniformsUtils.clone(filmShader.uniforms));
  const film=filmShader.fragmentShader
   .replace('uniform sampler2D tDiffuse;','')
   .replace('varying vec2 vUv;','')
   .replace('void main(){','vec4 filmColor(){')
   .replace('gl_FragColor = vec4(col, 1.0);','return vec4(col, 1.0);');
  this.material.fragmentShader=this.material.fragmentShader
   .replace('void main() {',film+'\nvoid main() {')
   .replace('gl_FragColor = texture2D( tDiffuse, vUv );','gl_FragColor = filmColor();');
 }
}
