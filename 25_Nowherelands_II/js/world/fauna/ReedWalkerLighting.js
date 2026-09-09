// A restrained fill for dark riverbanks. Keep the faceted shape and the shaded
// eyes: this uses the final diffuse color, rather than an unshaded emissive shell.
export function reedWalkerLighting(material, strength, legs = false) {
 const compile=material.onBeforeCompile, cacheKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  shader.uniforms.reedVisibility=strength;
  shader.fragmentShader='uniform float reedVisibility;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec3 reedWorldNormal = inverseTransformDirection(normal, viewMatrix);
   float reedSkyFill = mix(.48, 1.0, smoothstep(-.6, .8, reedWorldNormal.y));
   float reedEdge = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
   vec3 reedFill = diffuseColor.rgb * (${legs ? '.85' : '.55'} * reedSkyFill + .12 * reedEdge);
   outgoingLight = mix(outgoingLight, max(outgoingLight, reedFill), reedVisibility);
   #include <opaque_fragment>
  `);
 };
 material.customProgramCacheKey=()=>`${cacheKey}:reed-visibility-1:${legs?'legs':'body'}`;
}
