import * as THREE from 'three';

// Static continent-wide water data keeps shared vertex buffers, but spatial
// index lists allow ordinary frustum culling to reject off-screen reaches.
export function spatialWaterMesh(source, cellSize=1024, padding=2) {
 const geometry=source.geometry,position=geometry.attributes.position,index=geometry.index;
 const stride=source.isPoints?1:3,count=index?index.count:position.count;
 const cells=new Map(),point=new THREE.Vector3();
 for(let i=0;i<count;i+=stride){
  let x=0,z=0;const ids=[];
  for(let j=0;j<stride;j++){const id=index?index.getX(i+j):i+j;ids.push(id);x+=position.getX(id);z+=position.getZ(id);}
  const key=`${Math.floor(x/stride/cellSize)},${Math.floor(z/stride/cellSize)}`;
  let cell=cells.get(key);if(!cell)cells.set(key,cell={indices:[],box:new THREE.Box3()});
  for(const id of ids){cell.indices.push(id);cell.box.expandByPoint(point.fromBufferAttribute(position,id));}
 }
 const root=new THREE.Group();root.name='Spatial '+(source.name||'water');root.visible=source.visible;root.layers.mask=source.layers.mask;
 root.position.copy(source.position);root.quaternion.copy(source.quaternion);root.scale.copy(source.scale);
 // These world-space reaches never move; shader uniforms animate the water.
 if(source.matrixAutoUpdate)root.updateMatrix();else root.matrix.copy(source.matrix);
 root.matrixAutoUpdate=false;root.matrixWorldNeedsUpdate=true;
 root.userData.primitiveCount=count/stride;
 for(const [key,cell]of cells){
  const g=new THREE.BufferGeometry();for(const[name,attribute]of Object.entries(geometry.attributes))g.setAttribute(name,attribute);
  g.setIndex(cell.indices);g.boundingBox=cell.box.expandByScalar(padding);g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());
  const mesh=source.isPoints?new THREE.Points(g,source.material):new THREE.Mesh(g,source.material);
  mesh.name=`${root.name} ${key}`;mesh.renderOrder=source.renderOrder;mesh.layers.mask=source.layers.mask;mesh.onBeforeRender=source.onBeforeRender;
  mesh.matrixAutoUpdate=false;mesh.matrixWorldNeedsUpdate=true;
  root.add(mesh);
 }
 return root;
}
