import * as THREE from 'three';

// Eyes are shaded into the husk itself: no lids, eyeballs, rings or floating meshes.
// Object-space coordinates keep the crease attached through breathing and tilting.
export class ReedWalkerEyes {
 constructor(traits, material) {
  this.traits = traits;
  this.eyes = [-1, 1].map(side => ({ side, openness: 1 }));
  this.open = { value: new THREE.Vector2(1, 1) };
  material.onBeforeCompile = shader => {
   shader.uniforms.reedEyeOpen = this.open;
   shader.uniforms.reedBodySize = { value: new THREE.Vector3(traits.length, .87, traits.width) };
   shader.uniforms.reedEyeWidth = { value: traits.width * .17 };
   shader.vertexShader = 'varying vec3 vReedSurface;\nuniform vec3 reedBodySize;\n' + shader.vertexShader;
   shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvReedSurface = position * reedBodySize;');
   shader.fragmentShader = `
    varying vec3 vReedSurface;
    uniform vec2 reedEyeOpen;
    uniform float reedEyeWidth;
    uniform vec3 reedBodySize;
    vec3 reedEye(vec2 p, float openness) {
     float aa = max(fwidth(p.y), .001);
     float h = mix(.003, .067, openness);
     vec2 q = vec2(p.x / reedEyeWidth, (p.y + .016) / h);
     float oval = (length(q) - 1.0) * h;
     float lid = p.y - mix(-.014, .012, openness);
     float aperture = 1.0 - smoothstep(-aa, aa, max(oval, lid));
     // A subdued round iris peeks from under the heavy lid. No bright ring.
     vec2 irisPoint = p - vec2(0.0, -.012);
     float iris = 1.0 - smoothstep(.034 - aa, .034 + aa, length(irisPoint));
     float pupil = 1.0 - smoothstep(.018 - aa, .018 + aa, length(irisPoint));
     return vec3(aperture, iris * aperture, pupil * aperture);
    }
   ` + shader.fragmentShader;
   shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
    #include <color_fragment>
    vec2 leftEye = vec2(vReedSurface.z + reedBodySize.z * .43, vReedSurface.y - .16);
    vec2 rightEye = vec2(vReedSurface.z - reedBodySize.z * .43, vReedSurface.y - .16);
    float front = smoothstep(reedBodySize.x * .55, reedBodySize.x * .75, vReedSurface.x);
    vec3 eye = max(reedEye(leftEye, reedEyeOpen.x), reedEye(rightEye, reedEyeOpen.y)) * front;
    vec3 husk = diffuseColor.rgb;
    diffuseColor.rgb = mix(husk, husk * .37, eye.x);
    diffuseColor.rgb = mix(diffuseColor.rgb, husk * .64 + vec3(.014, .011, .005), eye.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, husk * .26, eye.z);
   `);
  };
  material.customProgramCacheKey = () => 'reed-husk-eyes-v2';
 }
 update(time) {
  const period = 10.5 + this.traits.patience * 2;
  this.eyes.forEach((eye, i) => {
   const t = (time + period - 3.5 - i * .07) % period;
   const blink = t < .9 ? Math.sin(t / .9 * Math.PI) ** 2 : 0;
   eye.openness = (this.traits.age === 'old' ? .7 : .9) * (1 - blink);
   this.open.value.setComponent(i, eye.openness);
  });
 }
}
