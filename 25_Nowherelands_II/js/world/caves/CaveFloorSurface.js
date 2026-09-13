// Index the exact triangles sent to the renderer. Keep references into immutable
// cave mesh buffers rather than a second copy of each triangle's coordinates.
const CELL = 8, STRIDE = 2;
export class CaveFloorSurface {
 constructor(data) {
  this.cells = new Map();
  this.sampleCache=new Float64Array(2048*7);this.sampleCaves=new Array(2048);
  this.cacheHits=0;this.cacheMisses=0;
  const chunks=this.chunks=[...data.chunks,...data.decorations];let count=0;
  for(const chunk of chunks){
   const p=chunk.position,index=chunk.index,n=index?index.length:p.length/3;
   for(let i=0;i<n;i+=3){
    const a=index?index[i]*3:i*3,b=index?index[i+1]*3:a+3,c=index?index[i+2]*3:a+6;
    if((p[b+2]-p[a+2])*(p[c]-p[a])-(p[b]-p[a])*(p[c+2]-p[a+2])>=1e-7)count++;
   }
  }
  const triangles=this.triangles=new Uint32Array(count*STRIDE);let offset=0;
  for(let chunkId=0;chunkId<chunks.length;chunkId++) {
   const chunk=chunks[chunkId],p=chunk.position,index=chunk.index,n=index?index.length:p.length/3;
   for(let i=0;i<n;i+=3) {
    const a=index?index[i]*3:i*3,b=index?index[i+1]*3:a+3,c=index?index[i+2]*3:a+6;
    const x=p[a],z=p[a+2],ax=p[b]-x,az=p[b+2]-z,bx=p[c]-x,bz=p[c+2]-z;
    if(az*bx-ax*bz<1e-7)continue;
    const tri=offset;triangles[offset++]=chunkId;triangles[offset++]=i;
    for(let iz=Math.floor(Math.min(z,z+az,z+bz)/CELL);iz<=Math.floor(Math.max(z,z+az,z+bz)/CELL);iz++)
    for(let ix=Math.floor(Math.min(x,x+ax,x+bx)/CELL);ix<=Math.floor(Math.max(x,x+ax,x+bx)/CELL);ix++) {
     const key=`${chunk.cave}:${ix},${iz}`;
     let cell=this.cells.get(key);if(!cell){cell=[];this.cells.set(key,cell);}cell.push(tri);
    }
   }
  }
  // Subdivide each original cell without extending its query coverage. Keep
  // triangle order and pad the fine bins for the existing barycentric tolerance.
  let references=0;
  for(const[key,cell]of this.cells){
   const [cx,cz]=key.slice(key.lastIndexOf(':')+1).split(',').map(Number),ox=cx*CELL,oz=cz*CELL;
   const bins=Array.from({length:16},()=>[]);
   for(const t of cell){
    const chunk=chunks[triangles[t]],vertex=triangles[t+1],p=chunk.position,index=chunk.index;
    const a=index?index[vertex]*3:vertex*3,b=index?index[vertex+1]*3:a+3,c=index?index[vertex+2]*3:a+6;
    const x=p[a],z=p[a+2],ax=p[b]-x,az=p[b+2]-z,bx=p[c]-x,bz=p[c+2]-z;
    const px=.00002*(Math.abs(ax)+Math.abs(bx))+Number.EPSILON*Math.max(1,Math.abs(x),Math.abs(ax),Math.abs(bx))*8;
    const pz=.00002*(Math.abs(az)+Math.abs(bz))+Number.EPSILON*Math.max(1,Math.abs(z),Math.abs(az),Math.abs(bz))*8;
    const x0=Math.max(0,Math.min(3,Math.floor((Math.min(x,x+ax,x+bx)-px-ox)/2)));
    const x1=Math.max(0,Math.min(3,Math.floor((Math.max(x,x+ax,x+bx)+px-ox)/2)));
    const z0=Math.max(0,Math.min(3,Math.floor((Math.min(z,z+az,z+bz)-pz-oz)/2)));
    const z1=Math.max(0,Math.min(3,Math.floor((Math.max(z,z+az,z+bz)+pz-oz)/2)));
    for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++)bins[iz*4+ix].push(t);
   }
   this.cells.set(key,bins);references+=32;for(const bin of bins)references+=bin.length;
  }
  this.references=new Uint32Array(references);let cursor=0;
  for(const[key,bins]of this.cells){
   const base=cursor;this.cells.set(key,base);cursor+=16;
   for(let i=0;i<16;i++){
    const bin=bins[i];this.references[base+i]=cursor;this.references[cursor++]=bin.length;
    this.references.set(bin,cursor);cursor+=bin.length;
   }
  }
 }
 sample(cave,x,z,floor,ceiling) {
  const slot=(Math.imul((x*1024)|0,73856093)^Math.imul((z*1024)|0,19349663))&2047,k=slot*7,a=this.sampleCache;
  if(a[k+6] && this.sampleCaves[slot]===cave && Object.is(a[k],x) && Object.is(a[k+1],z) && Object.is(a[k+2],floor) && Object.is(a[k+3],ceiling)) {
   this.cacheHits++;return a[k+6]===2?null:{ground:a[k+4],slope:a[k+5]};
  }
  this.cacheMisses++;const result=this.sampleUncached(cave,x,z,floor,ceiling);
  this.sampleCaves[slot]=cave;a[k]=x;a[k+1]=z;a[k+2]=floor;a[k+3]=ceiling;
  a[k+4]=result?.ground??0;a[k+5]=result?.slope??0;a[k+6]=result?1:2;
  return result;
 }
 sampleUncached(cave,x,z,floor,ceiling) {
  let ground=-Infinity,slope=0;const triangles=this.triangles;
  const base=this.cells.get(`${cave}:${Math.floor(x/CELL)},${Math.floor(z/CELL)}`);
  if(base===undefined)return null;
  const refs=this.references,start=refs[base+(Math.floor(x/2)&3)+(Math.floor(z/2)&3)*4],end=start+1+refs[start];
  for(let i=start+1;i<end;i++) {
   const t=refs[i],chunk=this.chunks[triangles[t]],vertex=triangles[t+1],p=chunk.position,index=chunk.index;
   const a=index?index[vertex]*3:vertex*3,b=index?index[vertex+1]*3:a+3,c=index?index[vertex+2]*3:a+6;
   const ax=p[b]-p[a],az=p[b+2]-p[a+2],bx=p[c]-p[a],bz=p[c+2]-p[a+2],up=az*bx-ax*bz;
   const dx=x-p[a],dz=z-p[a+2],u=(dx*bz-dz*bx)/-up,v=(ax*dz-az*dx)/-up;
   if(u<-.00001 || v<-.00001 || u+v>1.00001)continue;
   const ay=p[b+1]-p[a+1],by=p[c+1]-p[a+1],slopeX=(az*by-ay*bz)/up,slopeZ=(ay*bx-ax*by)/up;
   const y=p[a+1]+slopeX*dx+slopeZ*dz;
   if(y<floor-5 || y>floor+8 || y>ceiling-3.5 || y<=ground)continue;
   ground=y;slope=Math.hypot(slopeX,slopeZ);
  }
  return Number.isFinite(ground)?{ground,slope}:null;
 }
}
