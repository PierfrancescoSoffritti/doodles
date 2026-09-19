import * as THREE from 'three';

// Retain actual material owners after warming, so unloading the last visible
// patch cannot evict its programs. Reply masks render on their own layer with
// no world lights: Three includes that light count in even unlit program keys.
export async function warmStreamedMaterials(shared, roots, {includeHidden=false}={}) {
 const {renderer,scene:world}=shared;
 world.updateMatrixWorld(true);
 const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
 const target=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType});
 try {
  for(const mask of [shared.camera.layers.mask,1<<30]){
   const scene=new THREE.Scene(),camera=shared.camera.clone();camera.layers.mask=mask;
   scene.environment=world.environment;scene.environmentIntensity=world.environmentIntensity;scene.fog=world.fog;
   let meshes=0;
   for(const root of roots)root[includeHidden||mask===(1<<30)?'traverse':'traverseVisible'](source=>{
    if(!(source.isMesh||source.isLine||source.isPoints||source.isSprite)||!source.layers.test(camera.layers))return;
    const mesh=source.clone(false);mesh.frustumCulled=false;mesh.visible=true;
    // Empty retained fauna pools still need a real draw to warm the driver.
    if(mesh.isInstancedMesh&&mesh.instanceMatrix.count)mesh.count=Math.max(1,mesh.count);
    mesh.onBeforeRender=()=>{};mesh.onAfterRender=()=>{};scene.add(mesh);meshes++;
   });
   if(!meshes)continue;
   world.traverseVisible(light=>{
    if(!light.isLight||!light.layers.test(camera.layers))return;
    const copy=light.clone();copy.position.setFromMatrixPosition(light.matrixWorld);scene.add(copy);
   });
   try{
    let ready;
    try{renderer.setRenderTarget(target);ready=renderer.compileAsync(scene,camera);}
    finally{renderer.setRenderTarget(previous,face,mip);}
    await ready;
    renderer.setRenderTarget(target);renderer.render(scene,camera);
   }finally{
    // clone() gives instanced meshes their own instance buffers. Release those
    // temporary buffers, while retaining the shared geometry and materials.
    for(const mesh of scene.children)if(mesh.isInstancedMesh)mesh.dispose();
    scene.clear();
   }
  }
 }finally{renderer.setRenderTarget(previous,face,mip);target.dispose();}
}
