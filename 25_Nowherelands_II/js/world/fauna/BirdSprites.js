import * as THREE from 'three';
import {birdCardAxes} from './SpriteBirds.js?v=birds-10';
const FRAMES=16,CELL=128,VARIANTS=3;
// A single overhead/underside flight silhouette. Each frame gets its own array
// layer, so minification can never sample a neighbouring animation/view frame.
function atlas(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=CELL;const c=canvas.getContext('2d');
 const pixels=new Uint8Array(CELL*CELL*4*FRAMES*VARIANTS);
 const poly=points=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
 const oval=(x,y,rx,ry)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
 for(let variant=0;variant<VARIANTS;variant++)for(let f=0;f<FRAMES;f++){
  c.clearRect(0,0,CELL,CELL);c.fillStyle='#ffffff';
  const stroke=Math.cos(f/FRAMES*Math.PI*2),span=1-Math.abs(stroke)*.30,sweep=stroke*11;
  oval(64,63,variant===2?3.3:4.1,variant===1?15:13);oval(64,48,3.7,4.2);poly([[62,46],[64,40],[66,46]]);
  poly(variant===2?[[62,74],[56,94],[64,83],[72,94],[66,74]]:[[62,74],[57,88],[71,88],[66,74]]);
  for(const s of [-1,1]){
   const outline=variant===0?[[3,56],[23*span,48+sweep*.3],[55*span,43+sweep],[51*span,51+sweep],[45*span,55+sweep],[34*span,59+sweep*.6],[15,67],[3,67]]:
    variant===1?[[3,56],[23*span,46+sweep*.3],[56*span,37+sweep],[51*span,44+sweep],[39*span,52+sweep*.6],[17,64],[3,66]]:
    [[3,55],[22*span,50+sweep*.3],[52*span,38+sweep],[44*span,53+sweep],[24,63+sweep*.4],[3,65]];
   poly(outline.map(([x,y])=>[64+s*x,y]));
  }
  // Data textures are not flipped by WebGL. Store bottom-up rows explicitly.
  const data=c.getImageData(0,0,CELL,CELL).data;
  for(let y=0;y<CELL;y++)pixels.set(data.subarray(y*CELL*4,(y+1)*CELL*4),((variant*FRAMES+f)*CELL*CELL+(CELL-1-y)*CELL)*4);
 }
 const texture=new THREE.DataArrayTexture(pixels,CELL,CELL,FRAMES*VARIANTS);texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType;
 texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
export class BirdSprites {
 constructor(scene,capacity,{size=2.65,fogNear=100,fogFar=280,nearFade=0,farFade=10000}={}){
  this.texture=atlas();const base=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry().copy(base);base.dispose();
  for(const [name,size]of [['aCenter',3],['aForward',3],['aRight',3],['aFrame',1],['aOpacity',1],['aStyle',2]])g.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.DynamicDrawUsage));
  this.geometry=g;this.material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,side:THREE.DoubleSide,transparent:true,depthWrite:false,
   uniforms:{uAtlas:{value:this.texture},uFog:{value:new THREE.Color('#d9ded9')},uInk:{value:new THREE.Color().setRGB(.035,.05,.06)},uSize:{value:size},uFogRange:{value:new THREE.Vector2(fogNear,fogFar)},uFadeRange:{value:new THREE.Vector2(nearFade,farFade)}},vertexShader:`
   in vec3 aCenter,aForward,aRight;in float aFrame,aOpacity;in vec2 aStyle;uniform float uSize;out float vTint;out float vOpacity;out vec2 vUv;flat out float vFrame;out float vDistance;
   void main(){vUv=uv;vFrame=aFrame;vOpacity=aOpacity;vTint=aStyle.y;vec3 world=aCenter+(aRight*position.x+aForward*position.y)*uSize*aStyle.x;
    vec4 p=modelViewMatrix*vec4(world,1.);vDistance=length(p.xyz);gl_Position=projectionMatrix*p;}
  `,fragmentShader:`
   precision highp sampler2DArray;uniform sampler2DArray uAtlas;uniform vec3 uFog,uInk;uniform vec2 uFogRange,uFadeRange;in float vOpacity,vTint;in vec2 vUv;flat in float vFrame;in float vDistance;out vec4 outputColor;
   #define gl_FragColor outputColor
   void main(){float a=texture(uAtlas,vec3(vUv,vFrame)).a;a*=vOpacity*smoothstep(uFadeRange.x,uFadeRange.x+20.,vDistance)*(1.-smoothstep(uFadeRange.y*.75,uFadeRange.y,vDistance));if(a<.025)discard;
    gl_FragColor=vec4(mix(uInk*vTint,uFog,smoothstep(uFogRange.x,uFogRange.y,vDistance)*.55),a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `});this.mesh=new THREE.Mesh(g,this.material);this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 dispose(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();this.texture.dispose();}
 update(birds){
  this.geometry.instanceCount=birds.length;
  birds.forEach((b,i)=>{
   const axes=birdCardAxes(b);
   this.geometry.attributes.aCenter.setXYZ(i,b.p.x,b.p.y,b.p.z);
   this.geometry.attributes.aForward.setXYZ(i,...axes.forward);this.geometry.attributes.aRight.setXYZ(i,...axes.right);
   this.geometry.attributes.aOpacity.setX(i,b.opacity ?? 1);
   this.geometry.attributes.aStyle.setXY(i,b.size ?? 1,b.tint ?? 1);
   this.geometry.attributes.aFrame.setX(i,(b.variant ?? 0)*FRAMES+(b.glide?4:Math.floor(((b.phase%1)+1)%1*FRAMES)));
  });
  for(const name of ['aCenter','aForward','aRight','aFrame','aOpacity','aStyle'])this.geometry.attributes[name].needsUpdate=true;
 }
}
