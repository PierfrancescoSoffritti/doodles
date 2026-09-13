// Compare complete chunk geometry/colliders and resumable work against a source snapshot.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const baseline=process.env.TRAVEL_BASELINE_DIRECTORY||'/tmp/nowherelands-travel-baseline';
const output=process.env.PLANT_OUTPUT||'/tmp/nowherelands-plant-work';
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--mute-audio']}),report={errors:[],sources:Object.fromEntries(['PlantPlacement.js','Vegetation.js','Terrain.js'].map(f=>[f,createHash('sha256').update(fs.readFileSync('25_Nowherelands_II/js/world/'+f)).digest('hex')])),baselineVegetation:createHash('sha256').update(fs.readFileSync(path.join(baseline,'js/world/Vegetation.js'))).digest('hex')};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.route('**/Vegetation.js?plant-before=1',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(baseline,'js/world/Vegetation.js'),'utf8')}));
 await page.route('**/js/main.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('requestAnimationFrame(frame);','requestAnimationFrame(frame); if(window.__plantPause)return;')});});
 await page.goto('http://127.0.0.1:8797/25_Nowherelands_II/?seed=umbra&fps=60');await page.waitForFunction(()=>window.__debug,{timeout:120000});await page.evaluate(()=>window.__plantPause=true);
 await page.evaluate(async()=>{const [{Vegetation:Before},THREE]=await Promise.all([import('./js/world/Vegetation.js?plant-before=1'),import('three')]);const v=__debug.terrain.vegetation;
  window.__plantThree=THREE;window.__plantPair=()=>[Before.prototype,Object.getPrototypeOf(v)].map(prototype=>Object.assign(Object.create(prototype),v,{scene:new THREE.Scene(),shared:{...v.shared,colliders:[]},chunks:new Map(),farChunks:new Map(),pr:{},_wind:{x:0,z:0},time:50}));
  window.__plantSnapshot=chunk=>JSON.stringify({meshes:chunk.meshes.map(m=>({type:m.type,count:m.count,attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([k,v])=>[k,[...v.array]])),index:m.geometry.index?[...m.geometry.index.array]:null,instanceMatrix:m.instanceMatrix?[...m.instanceMatrix.array]:null,box:m.geometry.boundingBox,sphere:m.geometry.boundingSphere,instanceSphere:m.boundingSphere})),colliders:chunk.colliders,groups:chunk.groups.map(g=>({pos:g.pos,ranges:g.ranges,count:g.count,pending:g.pending})),perches:chunk.birdPerches?.map(p=>({position:p.position,matrix:p.matrix,local:p.local,index:p.index,born:[...p.born]})),hosts:chunk.lanternHosts?.map(h=>({id:h.id,x:h.x,y:h.y,z:h.z,matrix:h.matrix,radius:h.radius}))});
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});report.chunks=[];
 for(const [cx,cz]of [[-4,9],[-5,10],[-2,8],[-5,0],[-3,9],[0,0],[2,6],[-6,7]]){
  const result=await page.evaluate(({cx,cz})=>{const pair=__plantPair(),costs=[],snapshots=[];
   for(let variant=0;variant<2;variant++){const v=pair[variant];v.centerX=cx;v.centerZ=cz;const key=v.key(cx,cz),iterator=v.buildChunk(key,cx,cz),times=[];
    while(true){const t=performance.now(),next=iterator.next();times.push(performance.now()-t);if(next.done)break;
     if(v.scene.children.length||v.shared.colliders.length)throw Error('partial chunk published');
     // Other streaming work is allowed to overwrite terrain/vegetation scratch fields between batches.
     v.look(cx*256+37,cz*256-19);
    }
    snapshots.push(__plantSnapshot(v.chunks.get(key)));costs.push({stages:times.length,total:times.reduce((a,b)=>a+b,0),max:Math.max(...times),over3:times.filter(t=>t>3).length,times});
   }
   if(snapshots[0]!==snapshots[1])throw Error(`Geometry/collider/growth mismatch at ${cx},${cz}`);
   const geometryCount=pair[0].chunks.values().next().value.meshes.length;
   let pixels,image;
   if(cx===-4&&cz===9){
    const d=__debug,T=__plantThree,camera=d.camera.clone(),renderer=d.renderer,gl=renderer.getContext();
    const x=cx*256,z=cz*256,y=d.heightmap.height(x,z);camera.position.set(x+140,y+110,z+180);camera.lookAt(x,y+20,z);camera.updateMatrixWorld(true);
    const images=[], uploads=[];
    for(const v of pair){v.scene.fog=d.scene.fog;v.scene.background=new T.Color('#171224');
     v.fadeUniforms.uVegetationCamera.value.set(x,z);
     for(const m of v.chunks.values().next().value.meshes){const born=m.geometry.attributes.aBorn;if(born){born.array.fill(-1e6);born.needsUpdate=true;}}
     const upload=gl.bufferData;let bytes=0,calls=0;
     gl.bufferData=function(target,data,...args){bytes+=typeof data==='number'?data:data?.byteLength||0;calls++;return upload.call(this,target,data,...args)};
     try{renderer.setRenderTarget(null);renderer.render(v.scene,camera);}finally{gl.bufferData=upload;}
     uploads.push({bytes,calls});const data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);images.push(data);
    }
    let changed=0,maxError=0,nonBackground=0;for(let i=0;i<images[0].length;i++){if(images[0][i]!==images[1][i]){changed++;maxError=Math.max(maxError,Math.abs(images[0][i]-images[1][i]));}if(i%4!==3&&images[0][i]!==images[0][i%4])nonBackground++;}
    if(changed)throw Error(`Rendered plants differ: ${changed} channels, max ${maxError}`);
    if(nonBackground<1000)throw Error('Visual check rendered too little geometry');pixels={changed,maxError,nonBackground,uploads};image=renderer.domElement.toDataURL();
   }
   for(const v of pair)v.removeChunk(v.key(cx,cz));
   return {cx,cz,geometryCount,exact:true,costs,pixels,image};
  },{cx,cz});if(result.image){fs.writeFileSync(path.join(output,'plants.png'),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;}report.chunks.push(result);console.log(JSON.stringify(result));
 }
 report.bufferLifetime=await page.evaluate(async()=>{
  const {sharedPlantGeometry}=await import('./js/world/SharedPlantGeometry.js'),T=__plantThree;
  const renderer=new T.WebGLRenderer({antialias:false}),gl=renderer.getContext();renderer.setSize(64,64);
  const source=new T.BoxGeometry(),material=new T.MeshBasicMaterial({color:0xff8855});
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,100);camera.position.z=3;
  const make=()=>{const g=sharedPlantGeometry(source);g.setAttribute('aBorn',new T.InstancedBufferAttribute(new Float32Array([0]),1));const m=new T.InstancedMesh(g,material,1);m.setMatrixAt(0,new T.Matrix4());return m;};
  const a=make(),b=make();let bytes=0,deletes=0;
  const upload=gl.bufferData,remove=gl.deleteBuffer;
  gl.bufferData=function(target,data,...args){bytes+=typeof data==='number'?data:data.byteLength;return upload.call(this,target,data,...args)};
  gl.deleteBuffer=function(...args){deletes++;return remove.apply(this,args)};
  const draw=m=>{scene.clear();scene.add(m);bytes=0;renderer.render(scene,camera);const pixels=new Uint8Array(64*64*4);gl.readPixels(0,0,64,64,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return {bytes,pixels};};
  try{
   const first=draw(a),second=draw(b);a.geometry.dispose();a.dispose();const afterRemoval=draw(b);
   if(afterRemoval.bytes!==0)throw Error('Disposing one plant caused surviving vertices to upload again');
   if(first.pixels.some((v,i)=>v!==second.pixels[i]||v!==afterRemoval.pixels[i]))throw Error('Shared geometry changed after a neighbour was disposed');
   if(first.pixels.filter((v,i)=>i%4!==3&&v!==0).length<100)throw Error('Empty shared-buffer lifetime image');
   const partialDeletes=deletes;b.geometry.dispose();b.dispose();const finalDeletes=deletes;
   const c=make(),reloaded=draw(c);if(reloaded.bytes!==first.bytes||reloaded.pixels.some((v,i)=>v!==first.pixels[i]))throw Error('Geometry failed to reload after final disposal');c.geometry.dispose();c.dispose();
   return {firstBytes:first.bytes,secondBytes:second.bytes,afterRemovalBytes:afterRemoval.bytes,partialDeletes,finalDeletes,reloadedBytes:reloaded.bytes,pixelsExact:true};
  }finally{gl.bufferData=upload;gl.deleteBuffer=remove;material.dispose();renderer.dispose();renderer.forceContextLoss();}
 });
 report.cancelled=await page.evaluate(()=>{const v=__plantPair()[1];v.centerX=-4;v.centerZ=9;let checks=0;
  for(const stop of [1,4,12,30,50]){const iterator=v.buildChunk('cancel',-4,9);for(let i=0;i<stop;i++)if(iterator.next().done)throw Error('Cancellation checkpoint passed commit');iterator.return();if(v.scene.children.length||v.shared.colliders.length||v.chunks.size)throw Error('cancelled chunk leaked');checks++;}
  return checks;
 });
 if(report.errors.length)throw Error(report.errors.join('\n'));
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}})();
