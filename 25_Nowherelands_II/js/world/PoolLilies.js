import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lilyPad } from '../atelier/WaterLilyGeometry.js';
import { lakeWaveGlsl } from './WaterShader.js?v=gate-dark-4';
import { LILY_PALETTES } from './WaterHabitats.js?v=streaming-60-30-19';
import { noiseGlsl } from './TerrainMaterial.js?v=gate-dark-4';

// Three draws per patch: leaves, ivory cups/petals, warm cores. No point lights,
// reflection render targets, shadows, or submerged stems per plant.
export class PoolLilies {
 constructor(parent,model,shared){
  this.model=model;this.batches=[];this.mirrorHide=shared.mirrorHide;
  const pieces=[],pose=new THREE.Object3D();
  // A continuous bowl closes every side gap. The entire glowing core sits below
  // its rim; the wide rim meets the petals instead of forming a bulb below them.
  const cup=new THREE.LatheGeometry([[0,0],[.12,.014],[.24,.065],[.37,.16],[.49,.255],[.63,.335]].map(([r,y])=>new THREE.Vector2(r,y)),24);
  cup.deleteAttribute('uv');
  cup.setAttribute('aPetal',new THREE.Float32BufferAttribute(new Float32Array(cup.attributes.position.count),1));
  cup.setAttribute('aForm',new THREE.Float32BufferAttribute(new Float32Array(cup.attributes.position.count*3),3));pieces.push(cup);
  for(let j=0;j<12;j++){
   const positions=[],forms=[],indices=[],inner=j>=6,angle=j%6/6*Math.PI*2+(inner?.5:0),length=inner?.48:.7,width=inner?.26:.36;
   for(let i=0;i<=8;i++)for(let side=-1;side<=1;side++){
    const t=i/8,r=.12+t*length,w=Math.pow(Math.sin(Math.PI*t),.7)*width*side;
    positions.push(r*Math.cos(angle)+w*Math.sin(angle),.16+.20*t+.065*Math.sin(t*Math.PI)+(side===0?.014:0),-r*Math.sin(angle)+w*Math.cos(angle));
    forms.push(t,side*width,angle);
   }
   for(let i=0;i<8;i++)for(let k=0;k<2;k++){const a=i*3+k;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
   const petal=new THREE.BufferGeometry();petal.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));petal.setIndex(indices);petal.computeVertexNormals();
   petal.setAttribute('aPetal',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3).fill(inner?.7:1),1));
   petal.setAttribute('aForm',new THREE.Float32BufferAttribute(forms,3));pieces.push(petal);
  }
  const flower=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
  const core=new THREE.SphereGeometry(1,10,6);core.scale(.14,.028,.14);core.translate(0,.13,0);
  const flowers=model.plants.filter(p=>p.bloom),pads=model.plants.flatMap(p=>Array.from({length:p.padCount},(_,j)=>({plant:p,j})));
  const specs=[{geometry:lilyPad(),list:pads,color:'#647e45',emissive:.10,kind:'pads'},
   {geometry:flower,list:flowers.map(plant=>({plant})),color:'#f5ecd4',emissive:.04,kind:'flowers'},
   {geometry:core,list:flowers.map(plant=>({plant})),color:'#f5ca72',emissive:.3,kind:'cores'}];
  for(const spec of specs){
   const {geometry,list,kind}=spec;if(!list.length){geometry.dispose();continue;}
   const material=new THREE.MeshStandardMaterial({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:spec.emissive,roughness:.85,flatShading:true,side:THREE.DoubleSide,vertexColors:kind==='pads'});
   const water=new Float32Array(list.length*3),glow=new THREE.InstancedBufferAttribute(new Float32Array(list.length),1).setUsage(THREE.DynamicDrawUsage);
   const nod=new THREE.InstancedBufferAttribute(new Float32Array(list.length),1).setUsage(THREE.DynamicDrawUsage);
   geometry.setAttribute('aNod',nod);
   // Rounded, pointed and ruffled petals share topology and a single draw.
   const shapes=[[1.12,.42,.0],[.76,1.45,.025],[1.05,.72,.055]];
   geometry.setAttribute('aShape',new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(({plant:p})=>shapes[p.flowerShape||0])),3));
   geometry.setAttribute('aWater',new THREE.InstancedBufferAttribute(water,3));geometry.setAttribute('aGlow',glow);
   material.onBeforeCompile=shader=>{
    shader.uniforms.uPoolTime=shared.terrainUniforms.uTime;shader.uniforms.uPoolNear=shared.inlandNearRadius||{value:150};
    shader.uniforms.uPoolOrigin={value:new THREE.Vector2(model.site.x,model.site.z)};
    shader.uniforms.uPoolLake={value:model.site.lake?1:0};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
     attribute vec3 aWater; attribute float aGlow; attribute float aNod; ${kind==='flowers'?'attribute float aPetal; attribute vec3 aForm; attribute vec3 aShape;':''} varying float vPoolGlow;
     uniform float uPoolTime,uPoolNear,uPoolLake; uniform vec2 uPoolOrigin;
     ${noiseGlsl}\n${lakeWaveGlsl}`)
     .replace('#include <begin_vertex>',`#include <begin_vertex>
      vPoolGlow=aGlow;
      ${kind==='flowers'?`float wave=max(0.,sin(aForm.x*3.14159265));
       float widthDelta=(pow(wave,aShape.y)*aShape.x-pow(wave,.7))*aForm.y;
       transformed.xz+=widthDelta*vec2(sin(aForm.z),cos(aForm.z));
       transformed.y+=aShape.z*sin(aForm.x*3.14159265)*cos(aForm.y*12.)*aPetal;
       transformed.xz*=1.+aPetal*aGlow*.16;
       transformed.y+=aPetal*length(position.xz)*(aNod*.35-aGlow*.025);`:''}
      vec2 waterAt=uPoolOrigin+aWater.xy;
      float nearFade=1.-smoothstep(max(0.,uPoolNear-50.),max(1.,uPoolNear),distance(waterAt,cameraPosition.xz));
      float bob=lakeWave(waterAt,uPoolTime,aWater.z)*nearFade*uPoolLake;
      transformed.${kind==='pads'?'z':'y'}+=bob/max(.01,length(instanceMatrix[${kind==='pads'?2:1}].xyz));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vPoolGlow;')
     .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\ntotalEmissiveRadiance = diffuseColor.rgb * (${kind==='cores'?'.8':kind==='flowers'?'.28':'.15'} + vPoolGlow * ${kind==='cores'?'3.7':kind==='flowers'?'1.8':'.12'});`);
   };
   material.customProgramCacheKey=()=>`pool-lily-${kind}-4`;
   const mesh=new THREE.InstancedMesh(geometry,material,list.length);mesh.name=`pool-lily-${kind}`;mesh.castShadow=mesh.receiveShadow=false;
   const color=new THREE.Color();
   list.forEach(({plant:p,j=0},i)=>{
    const a=p.turn,co=Math.cos(a),si=Math.sin(a);let x,z,size=p.size;
    if(kind==='pads'){
     const lx=j===0?.7:j===1?-.5:.5,lz=j===0?.3:j===1?.68:-.8;
     x=p.x+(lx*co+lz*si)*size;z=p.z+(-lx*si+lz*co)*size;
     pose.rotation.set(-Math.PI/2,0,-a+j*1.4);const padSize=size*(j===0?.9:j===1?.62:.48);pose.scale.set(padSize*(p.padAspect||1),padSize,1);
    }else{
     x=p.x-.23*co*size;z=p.z+.23*si*size;pose.rotation.set(0,a,0);pose.scale.set(size*p.openness*(p.petalLength||1),size*(p.flowerHeight??.85),size*p.openness);
    }
    pose.position.set(x,kind==='pads'?.045:.02,z);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
    const palette=LILY_PALETTES[p.palette||0];color.set(palette[kind==='pads'?'pad':kind==='flowers'?'petal':'core']).multiplyScalar(p.tint);mesh.setColorAt(i,color);
    water.set([x,z,p.depth],i*3);
   });
   mesh.computeBoundingSphere();mesh.boundingSphere.radius+=4;parent.add(mesh);
   // Inland flowers must not appear in the sea-level planar mirror: that image
   // sits below the actual lake and reads as a detached duplicate.
   this.mirrorHide?.add(mesh);this.batches.push({mesh,list,glow,nod,kind});
  }
 }
 update(){for(const {list,glow,nod,kind} of this.batches){let changed=false;list.forEach(({plant:p},i)=>{const value=Math.max(p.glow,p.hovered?.18:0);if(Math.abs(glow.getX(i)-value)>1e-4||Math.abs(nod.getX(i)-p.nod)>1e-4){glow.setX(i,value);nod.setX(i,p.nod);changed=true;}});if(changed){glow.needsUpdate=true;nod.needsUpdate=true;}}}
 dispose(){for(const {mesh} of this.batches){this.mirrorHide?.delete(mesh);mesh.removeFromParent();mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}this.batches=[];}
}
