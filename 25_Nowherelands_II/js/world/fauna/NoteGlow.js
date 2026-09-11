// Share uniforms across one articulated creature, so the pulse climbs its limbs
// into its crown even though those parts have separate local transforms.
export function noteGlow(material,uniforms) {
 const original=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=shader=>{
  original(shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vNoteHeight;').replace('#include <project_vertex>','vNoteHeight=(modelMatrix*vec4(transformed,1.0)).y;\n#include <project_vertex>');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vNoteHeight; uniform float uNoteGlow,uNotePhase,uNoteAlarm,uNoteFloor,uNoteHeight;').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float height=(vNoteHeight-uNoteFloor)/max(1.,uNoteHeight);
   float band=exp(-pow((height-uNotePhase*1.4)/.3,2.));
   vec3 signal=uNoteAlarm>.5?vec3(1.,.12,.035):vec3(1.,.62,.13);
   totalEmissiveRadiance+=signal*uNoteGlow*(.12+band*.45);
  `);
 };
 material.customProgramCacheKey=()=>key()+'-player-note-v1';
}
