import * as THREE from 'three';

// A thin inverted hull follows the exact production vertex deformation.
// It shares geometry/instance buffers; the original surface occludes its interior.
export function replyOutline(mesh,{signal={value:0},expression='uReplySignal'}={}){
 const source=mesh.material,viewport={value:new THREE.Vector2(1,1)};
 const fragment=`uniform float uReplySignal;varying float vReply;void main(){if(vReply<.01)discard;gl_FragColor=vec4(.7,.82,.86,vReply*.8);}`;
 const expand=`
 vReply=${expression};
 vec3 replyNormal=normal;
 #ifdef USE_INSTANCING
 replyNormal=mat3(instanceMatrix)*replyNormal;
 #endif
 replyNormal=normalMatrix*replyNormal;
 vec2 replyDirection=replyNormal.xy/max(length(replyNormal.xy),.0001);
 gl_Position.xy+=replyDirection*(2.4/uReplyViewport)*gl_Position.w;
 `;
 const inject=shader=>{
  Object.assign(shader.uniforms,{uReplySignal:signal,uReplyViewport:viewport});
  shader.vertexShader='uniform float uReplySignal;uniform vec2 uReplyViewport;varying float vReply;\n'+shader.vertexShader;
  if(shader.vertexShader.includes('#include <project_vertex>'))shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n'+expand);
  else shader.vertexShader=shader.vertexShader.replace(/}\s*$/,expand+'\n}');
  shader.fragmentShader=fragment;
 };
 let material;
 if(source.isShaderMaterial){material=source.clone();inject(material);}
 else {material=new THREE.MeshBasicMaterial({vertexColors:source.vertexColors});material.onBeforeCompile=shader=>{source.onBeforeCompile(shader);inject(shader);};material.customProgramCacheKey=()=>source.customProgramCacheKey()+'-reply-outline';}
 material.side=THREE.BackSide;material.transparent=true;material.depthWrite=false;material.toneMapped=false;
 const outline=mesh.isInstancedMesh?new THREE.InstancedMesh(mesh.geometry,material,mesh.instanceMatrix.count):new THREE.Mesh(mesh.geometry,material);
 if(mesh.isInstancedMesh)outline.instanceMatrix=mesh.instanceMatrix;
 outline.name=mesh.name+'-reply-outline';outline.frustumCulled=false;outline.renderOrder=4;mesh.add(outline);
 outline.onAfterRender=()=>{if(mesh.isInstancedMesh)outline.count=mesh.instanceMatrix.count;};
 outline.onBeforeRender=renderer=>{renderer.getDrawingBufferSize(viewport.value);if(mesh.isInstancedMesh)outline.count=mesh.count;};
 source.addEventListener('dispose',()=>{outline.removeFromParent();material.dispose();if(outline.isInstancedMesh)outline.dispose();});
 return {outline,signal};
}
