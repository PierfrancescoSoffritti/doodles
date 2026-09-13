import {CopyShader} from 'three/addons/shaders/CopyShader.js';
import * as THREE from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FilmShader} from '../../js/fx/PostProcessing.js?v=stable-30-3';
import {FilmOutputPass} from '../../js/fx/FilmOutputPass.js?v=stable-30-3';
export function checkFilmOutput(){
 const r=new THREE.WebGLRenderer({antialias:false});r.setSize(180,120);r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.05;
 const values=new Float32Array(180*120*4);for(let i=0;i<values.length;i+=4){const x=(i/4)%180,y=Math.floor(i/4/180);values[i]=x/179*6;values[i+1]=y/119*2;values[i+2]=(Math.sin(x*.43+y*.71)+1)*.05;values[i+3]=1;}
 const texture=new THREE.DataTexture(values,180,120,THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
 const middle=new THREE.WebGLRenderTarget(180,120,{type:THREE.HalfFloatType}),out=new THREE.WebGLRenderTarget(180,120),film=new ShaderPass(FilmShader),output=new OutputPass(),fused=new FilmOutputPass(FilmShader),copy=new ShaderPass(CopyShader),rows=[];
 try{for(const glare of [0,.4,1])for(const pulse of [0,.6]){
  for(const p of [film,fused]){p.uniforms.uTime.value=17.8;p.uniforms.uGlare.value=glare;p.uniforms.uPulse.value=pulse;}
  const images=[];
  film.render(r,middle,{texture});output.render(r,out,middle);images.push(new Uint8Array(180*120*4));r.readRenderTargetPixels(out,0,0,180,120,images[0]);
  fused.render(r,out,{texture});images.push(new Uint8Array(180*120*4));r.readRenderTargetPixels(out,0,0,180,120,images[1]);
  let max=0,sum=0;for(let i=0;i<images[0].length;i++){const delta=Math.abs(images[0][i]-images[1][i]);max=Math.max(max,delta);sum+=delta;}
  fused.render(r,middle,{texture});copy.render(r,out,middle);const buffered=new Uint8Array(180*120*4);r.readRenderTargetPixels(out,0,0,180,120,buffered);
  let bufferedMax=0;for(let i=0;i<buffered.length;i++)bufferedMax=Math.max(bufferedMax,Math.abs(images[1][i]-buffered[i]));
  if(bufferedMax>1)throw Error('Buffered presentation color drift: '+bufferedMax);
  rows.push({glare,pulse,max,bufferedMax,mean:sum/images[0].length});if(max>1)throw Error('Film conversion drift: '+JSON.stringify(rows.at(-1)));
 }return rows;}finally{for(const x of [texture,middle,out,film,output,fused,copy,r])x.dispose();}
}
