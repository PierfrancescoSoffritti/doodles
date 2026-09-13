import * as THREE from 'three';
import {REPLY_MASK_LAYER} from '../world/fauna/ReplyOutline.js?v=outline-2';

const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
// A bounded separable distance search gives a rounded contour with a clear gap.
// CSS-pixel targets keep the spacing consistent across device pixel ratios.
export class ReplyOutlinePass {
 constructor(){
  const options={minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false};
  this.mask=new THREE.WebGLRenderTarget(1,1,options);this.horizontal=new THREE.WebGLRenderTarget(1,1,options);
  this.fineTiles=new THREE.WebGLRenderTarget(1,1,options);this.tiles=new THREE.WebGLRenderTarget(1,1,options);this.occupied=new THREE.WebGLRenderTarget(1,1,options);
  this.size=new THREE.Vector2();this.clearColor=new THREE.Color();
  this.uniforms={tMask:{value:this.mask.texture},tHorizontal:{value:this.horizontal.texture},uTexel:{value:new THREE.Vector2(1,1)},tTileSource:{value:null},uTileSourceTexel:{value:new THREE.Vector2()},tTiles:{value:this.tiles.texture},tOccupied:{value:this.occupied.texture},uTileGrid:{value:new THREE.Vector2(1,1)}};
  // Derive conservative search regions from the actual deformed GPU mask. A
  // 16px tile plus two neighbouring tiles covers each +/-20px search, including
  // silhouettes crossing screen edges. Two 4x4 reductions avoid a long serial
  // 256-sample loop. No readback or CPU creature bounds.
  this.tileMask=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader,depthTest:false,depthWrite:false,fragmentShader:`
   uniform sampler2D tTileSource;uniform vec2 uTileSourceTexel;
   void main(){vec2 origin=floor(gl_FragCoord.xy)*4.;float occupied=0.;
    for(int y=0;y<4;y++)for(int x=0;x<4;x++){
     vec2 uv=(origin+vec2(float(x),float(y))+.5)*uTileSourceTexel;
     if(uv.x<1.&&uv.y<1.&&texture2D(tTileSource,uv).r>.01)occupied=1.;
    }gl_FragColor=vec4(occupied,0.,0.,1.);}`});
  this.expandTiles=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader,depthTest:false,depthWrite:false,fragmentShader:`
   uniform sampler2D tTiles;uniform vec2 uTileGrid;varying vec2 vUv;
   void main(){float occupied=0.;for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
    occupied=max(occupied,texture2D(tTiles,vUv+vec2(float(x),float(y))/uTileGrid).r);
   }gl_FragColor=vec4(occupied,0.,0.,1.);}`});
  const emptyTile=`uniform sampler2D tOccupied;uniform vec2 uTileGrid;
   bool emptyTile(){return texture2D(tOccupied,(floor(vUv/uTexel/16.)+.5)/uTileGrid).r<.5;}`;
  // A mask hit at the current pixel is already the exact nearest result. In
  // the contour pass, any known hit within the 2px gap guarantees a discard.
  this.distance=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader,depthTest:false,depthWrite:false,fragmentShader:`
   uniform sampler2D tMask;uniform vec2 uTexel;varying vec2 vUv;
   ${emptyTile}
   void main(){if(emptyTile()){gl_FragColor=vec4(1.,0.,0.,0.);return;}vec3 center=texture2D(tMask,vUv).rgb;if(center.r>.01){gl_FragColor=vec4(0.,center);return;}float nearest=21.;vec3 echo=vec3(0.);for(int x=-20;x<=20;x++){
    vec2 uv=vUv+vec2(float(x)*uTexel.x,0.);if(uv.x<0.||uv.x>1.)continue;
    vec3 s=texture2D(tMask,uv).rgb;float d=abs(float(x));if(s.r>.01&&d<nearest){nearest=d;echo=s;}
   }gl_FragColor=vec4(nearest/21.,echo);}`});
  this.contour=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,fragmentShader:`
   uniform sampler2D tHorizontal;uniform vec2 uTexel;varying vec2 vUv;
   ${emptyTile}
   void main(){if(emptyTile())discard;vec4 center=texture2D(tHorizontal,vUv);if(center.g>.01&&center.r*21.<2.)discard;float nearest=21.;vec3 echo=vec3(0.);for(int y=-20;y<=20;y++){
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
  this.fineTiles.setSize(Math.ceil(w/4),Math.ceil(h/4));
  const tw=Math.ceil(w/16),th=Math.ceil(h/16);
  if(this.tiles.width!==tw||this.tiles.height!==th){this.tiles.setSize(tw,th);this.occupied.setSize(tw,th);this.uniforms.uTileGrid.value.set(tw,th);}
  const target=renderer.getRenderTarget(),layers=camera.layers.mask,background=scene.background,autoClear=renderer.autoClear,alpha=renderer.getClearAlpha();
  renderer.getClearColor(this.clearColor);
  try{
   renderer.autoClear=true;renderer.setClearColor(0,0);scene.background=null;camera.layers.set(REPLY_MASK_LAYER);
   renderer.setRenderTarget(this.mask);renderer.render(scene,camera);
   camera.layers.mask=layers;scene.background=background;
   this.quad.material=this.tileMask;this.uniforms.tTileSource.value=this.mask.texture;this.uniforms.uTileSourceTexel.value.copy(this.uniforms.uTexel.value);
   renderer.setRenderTarget(this.fineTiles);renderer.render(this.scene,this.camera);
   this.uniforms.tTileSource.value=this.fineTiles.texture;this.uniforms.uTileSourceTexel.value.set(1/this.fineTiles.width,1/this.fineTiles.height);
   renderer.setRenderTarget(this.tiles);renderer.render(this.scene,this.camera);
   this.quad.material=this.expandTiles;renderer.setRenderTarget(this.occupied);renderer.render(this.scene,this.camera);
   this.quad.material=this.distance;renderer.setRenderTarget(this.horizontal);renderer.render(this.scene,this.camera);
   renderer.setRenderTarget(target);renderer.autoClear=false;this.quad.material=this.contour;renderer.render(this.scene,this.camera);
  }finally{camera.layers.mask=layers;scene.background=background;renderer.setRenderTarget(target);renderer.setClearColor(this.clearColor,alpha);renderer.autoClear=autoClear;}
 }
 dispose(){this.mask.dispose();this.horizontal.dispose();this.fineTiles.dispose();this.tiles.dispose();this.occupied.dispose();this.tileMask.dispose();this.expandTiles.dispose();this.distance.dispose();this.contour.dispose();this.quad.geometry.dispose();}
}
