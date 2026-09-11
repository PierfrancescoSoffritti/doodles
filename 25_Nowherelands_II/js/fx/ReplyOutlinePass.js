import * as THREE from 'three';
import {REPLY_MASK_LAYER} from '../world/fauna/ReplyOutline.js?v=outline-2';

const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
// A bounded separable distance search gives a rounded contour with a clear gap.
// CSS-pixel targets keep the spacing consistent across device pixel ratios.
export class ReplyOutlinePass {
 constructor(){
  const options={minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false};
  this.mask=new THREE.WebGLRenderTarget(1,1,options);this.horizontal=new THREE.WebGLRenderTarget(1,1,options);
  this.size=new THREE.Vector2();this.clearColor=new THREE.Color();
  this.uniforms={tMask:{value:this.mask.texture},tHorizontal:{value:this.horizontal.texture},uTexel:{value:new THREE.Vector2(1,1)}};
  this.distance=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader,depthTest:false,depthWrite:false,fragmentShader:`
   uniform sampler2D tMask;uniform vec2 uTexel;varying vec2 vUv;
   void main(){float nearest=21.;vec3 echo=vec3(0.);for(int x=-20;x<=20;x++){
    vec2 uv=vUv+vec2(float(x)*uTexel.x,0.);if(uv.x<0.||uv.x>1.)continue;
    vec3 s=texture2D(tMask,uv).rgb;float d=abs(float(x));if(s.r>.01&&d<nearest){nearest=d;echo=s;}
   }gl_FragColor=vec4(nearest/21.,echo);}`});
  this.contour=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,fragmentShader:`
   uniform sampler2D tHorizontal;uniform vec2 uTexel;varying vec2 vUv;
   void main(){float nearest=21.;vec3 echo=vec3(0.);for(int y=-20;y<=20;y++){
    vec2 uv=vUv+vec2(0.,float(y)*uTexel.y);if(uv.y<0.||uv.y>1.)continue;
    vec4 h=texture2D(tHorizontal,uv);float d=length(vec2(h.r*21.,float(y)));
    if(h.g>.01&&d<nearest){nearest=d;echo=h.gba;}
   }
   if(echo.x<.01||nearest<2.)discard;
   float charged=step(.5,echo.z),progress=echo.y,ink=0.;vec2 pixel=vUv/uTexel;
   for(int i=0;i<3;i++){
    if(i>0&&charged<.5)break;
    float strand=float(i),age=(progress-strand*.18)/mix(1.,.64,charged);
    if(age<=0.||age>=1.)continue;
    float travel=1.-pow(1.-age,1.4),radius=3.8+14.*travel;
    // Smooth patches break the contour into arcs; each echo slides and fades independently.
    float field=sin(pixel.x*.17+sin(pixel.y*.11+strand)*1.8-age*3.2+strand*2.4)
                +.55*sin(pixel.y*.21-pixel.x*.07+age*2.1+strand);
    float segments=smoothstep(.1,.5,field);
    float envelope=smoothstep(0.,.08,age)*(1.-smoothstep(.42,1.,age));
    float line=1.-smoothstep(.3,1.05,abs(nearest-radius));
    ink=max(ink,line*segments*envelope*(.78-strand*.16));
   }
   vec3 color=mix(vec3(.7,.82,.86),vec3(.82,.78,.68),charged*.45);
   gl_FragColor=vec4(color,ink*echo.x);}`});
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.distance);this.quad.frustumCulled=false;this.scene.add(this.quad);
 }
 render(renderer,scene,camera){
  renderer.getSize(this.size);const w=Math.max(1,Math.round(this.size.x)),h=Math.max(1,Math.round(this.size.y));
  if(this.mask.width!==w||this.mask.height!==h){this.mask.setSize(w,h);this.horizontal.setSize(w,h);this.uniforms.uTexel.value.set(1/w,1/h);}
  const target=renderer.getRenderTarget(),layers=camera.layers.mask,background=scene.background,autoClear=renderer.autoClear,alpha=renderer.getClearAlpha();
  renderer.getClearColor(this.clearColor);
  try{
   renderer.autoClear=true;renderer.setClearColor(0,0);scene.background=null;camera.layers.set(REPLY_MASK_LAYER);
   renderer.setRenderTarget(this.mask);renderer.render(scene,camera);
   camera.layers.mask=layers;scene.background=background;
   this.quad.material=this.distance;renderer.setRenderTarget(this.horizontal);renderer.render(this.scene,this.camera);
   renderer.setRenderTarget(target);renderer.autoClear=false;this.quad.material=this.contour;renderer.render(this.scene,this.camera);
  }finally{camera.layers.mask=layers;scene.background=background;renderer.setRenderTarget(target);renderer.setClearColor(this.clearColor,alpha);renderer.autoClear=autoClear;}
 }
 dispose(){this.mask.dispose();this.horizontal.dispose();this.distance.dispose();this.contour.dispose();this.quad.geometry.dispose();}
}
