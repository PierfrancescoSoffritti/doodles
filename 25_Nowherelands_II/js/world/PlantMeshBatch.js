import * as THREE from 'three';

// Static vertices, one draw, and nine texels per articulated part. Only transforms
// and material values change: the GPU moves the vertices, not a JS loop per vertex.
export class PlantMeshBatch {
 constructor(rig,parent) {
  this.rig=rig;this.parent=parent;this.inverse=new THREE.Matrix4();this.matrix=new THREE.Matrix4();this.normal=new THREE.Matrix3();
  const parts=[];
  rig.root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.isReflector||mesh===rig.visitor)return;
   parts.push(mesh);mesh.visible=false;mesh.updateMatrix();mesh.matrixAutoUpdate=false;
  });
  const count=parts.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.attributes.position.count),0);
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3),ids=new Float32Array(count);
  let at=0;
  for(const [id,part] of parts.entries()){
   const p=part.geometry.attributes.position,n=part.geometry.attributes.normal,index=part.geometry.index;
   for(let i=0;i<(index?.count??p.count);i++){
    const k=index?index.getX(i):i;
    positions.set([p.getX(k),p.getY(k),p.getZ(k)],at*3);normals.set([n.getX(k),n.getY(k),n.getZ(k)],at*3);ids[at++]=id;
   }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('aPlantPart',new THREE.BufferAttribute(ids,1));
  this.data=new Float32Array(parts.length*36);this.texture=new THREE.DataTexture(this.data,9,parts.length,THREE.RGBAFormat,THREE.FloatType);
  this.range={value:new THREE.Vector2(380,520)};this.viewer={value:new THREE.Vector2()};
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.88,flatShading:true,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{uPlantParts:{value:this.texture},uPlantRows:{value:parts.length},uPlantRange:this.range,uPlantViewer:this.viewer});
   shader.vertexShader=`uniform sampler2D uPlantParts;uniform float uPlantRows;attribute float aPlantPart;
    varying vec4 vPlantColor,vPlantEmission;varying vec2 vPlantBase;
    vec4 plantCell(float x){return texture2D(uPlantParts,vec2((x+.5)/9.,(aPlantPart+.5)/uPlantRows));}\n`+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    mat3 plantNormal=mat3(plantCell(4.).xyz,plantCell(5.).xyz,plantCell(6.).xyz);objectNormal=plantNormal*objectNormal;`)
    .replace('#include <begin_vertex>',`mat4 plantTransform=mat4(plantCell(0.),plantCell(1.),plantCell(2.),plantCell(3.));
     vec3 transformed=(plantTransform*vec4(position,1.)).xyz;
     vPlantColor=plantCell(7.);vPlantEmission=plantCell(8.);vPlantBase=modelMatrix[3].xz;`);
   shader.fragmentShader=`uniform vec2 uPlantRange,uPlantViewer;varying vec4 vPlantColor,vPlantEmission;varying vec2 vPlantBase;\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    diffuseColor.rgb*=vPlantColor.rgb;
    float coverage=1.-smoothstep(uPlantRange.x,uPlantRange.y,distance(vPlantBase,uPlantViewer));
    // Coverage fade preserves full size and depth writes; no transparent sorting.
    float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    if(coverage<=noise)discard;`)
    .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vPlantEmission.rgb;')
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vPlantColor.a;')
    .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vPlantEmission.a;');
  };
  material.customProgramCacheKey=()=> 'world-plant-parts-v1';
  const mesh=new THREE.Mesh(geometry,material);parent.add(mesh);this.batches=[{mesh,parts}];this.update();
  // Conservative bounds include wind, brushing, flower nods and the willow crown.
  const point=new THREE.Vector3();let radius=0;
  for(const part of parts){this.matrix.multiplyMatrices(this.inverse,part.matrixWorld);const p=part.geometry.attributes.position;
   for(let i=0;i<p.count;i++)radius=Math.max(radius,point.fromBufferAttribute(p,i).applyMatrix4(this.matrix).length());
  }
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),radius*1.5+2);
 }
 update(){
  this.parent.updateWorldMatrix(true,false);this.rig.root.updateWorldMatrix(true,true);this.inverse.copy(this.parent.matrixWorld).invert();
  for(const [i,part] of this.batches[0].parts.entries()){
   const offset=i*36;this.matrix.multiplyMatrices(this.inverse,part.matrixWorld);this.normal.getNormalMatrix(this.matrix);
   this.matrix.toArray(this.data,offset);
   for(let c=0;c<3;c++)for(let r=0;r<3;r++)this.data[offset+16+c*4+r]=this.normal.elements[c*3+r];
   const m=part.material;m.color.toArray(this.data,offset+28);this.data[offset+31]=m.roughness??.88;
   this.data[offset+32]=m.emissive.r*m.emissiveIntensity;this.data[offset+33]=m.emissive.g*m.emissiveIntensity;this.data[offset+34]=m.emissive.b*m.emissiveIntensity;this.data[offset+35]=m.metalness||0;
  }
  this.texture.needsUpdate=true;
 }
 dispose(){for(const {mesh} of this.batches){mesh.geometry.dispose();mesh.material.dispose();mesh.removeFromParent();}this.texture.dispose();this.batches=[];}
}
