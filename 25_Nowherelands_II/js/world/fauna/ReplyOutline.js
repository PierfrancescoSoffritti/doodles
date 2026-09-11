import * as THREE from 'three';

// Only the silhouette pass sees these meshes. Share the production deformation,
// uniforms and instance buffers so the mask follows the animated body exactly.
export const REPLY_MASK_LAYER=30;
export function replyOutline(mesh,{signal={value:0},expression='uReplySignal',echo={value:new THREE.Vector2()}}={}){
 const source=mesh.material;
 if(mesh.isInstancedMesh&&!mesh.geometry.attributes.aReplyEcho)mesh.geometry.setAttribute('aReplyEcho',new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count*2),2).setUsage(THREE.DynamicDrawUsage));
 const inject=shader=>{
  shader.uniforms.uReplySignal=signal;shader.uniforms.uReplyEcho=echo;
  shader.vertexShader='uniform float uReplySignal;uniform vec2 uReplyEcho;varying float vReplyMask;varying vec2 vReplyEcho;\n'+(mesh.isInstancedMesh?'attribute vec2 aReplyEcho;\n':'')+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace(/}\s*$/,`vReplyMask=${expression};vReplyEcho=${mesh.isInstancedMesh?'aReplyEcho':'uReplyEcho'};\n}`);
  shader.fragmentShader='varying float vReplyMask;varying vec2 vReplyEcho;void main(){if(vReplyMask<.01)discard;gl_FragColor=vec4(vReplyMask,vReplyEcho,1.);}';
 };
 let material;
 if(source.isShaderMaterial){material=source.clone();material.uniforms={...source.uniforms};inject(material);}
 else {material=new THREE.MeshBasicMaterial({vertexColors:source.vertexColors});material.onBeforeCompile=shader=>{source.onBeforeCompile(shader);inject(shader);};material.customProgramCacheKey=()=>source.customProgramCacheKey()+'-reply-mask';}
 material.side=THREE.DoubleSide;material.transparent=true;material.depthTest=false;material.depthWrite=false;material.toneMapped=false;
 material.blending=THREE.CustomBlending;material.blendEquation=THREE.MaxEquation;material.blendSrc=THREE.OneFactor;material.blendDst=THREE.OneFactor;
 const outline=mesh.isInstancedMesh?new THREE.InstancedMesh(mesh.geometry,material,mesh.instanceMatrix.count):new THREE.Mesh(mesh.geometry,material);
 if(mesh.isInstancedMesh)outline.instanceMatrix=mesh.instanceMatrix;
 outline.name=mesh.name+'-reply-mask';outline.layers.set(REPLY_MASK_LAYER);outline.frustumCulled=false;mesh.add(outline);
 outline.onBeforeRender=()=>{if(mesh.isInstancedMesh)outline.count=mesh.count;};
 outline.onAfterRender=()=>{if(mesh.isInstancedMesh)outline.count=mesh.instanceMatrix.count;};
 source.addEventListener('dispose',()=>{outline.removeFromParent();material.dispose();if(outline.isInstancedMesh)outline.dispose();});
 return {outline,signal,echo};
}

export function writeReplyEcho(mesh,index,creature){
 const echo=mesh.geometry.attributes.aReplyEcho;
 echo.setXY(index,creature.replyProgress||0,creature.replyCharged?1:0);echo.needsUpdate=true;
}
