// Index the same triangles sent to the renderer. Cave density is sampled on a
// 3.2-unit mesh grid; its analytic floor is not the visible triangle surface.
const CELL = 8;
export class CaveFloorSurface {
 constructor(data) {
  this.cells = new Map();
  for (const chunk of [...data.chunks, ...data.decorations]) {
   const p=chunk.position;
   for(let i=0;i<p.length;i+=9) {
    const x=p[i],y=p[i+1],z=p[i+2], ax=p[i+3]-x,ay=p[i+4]-y,az=p[i+5]-z,bx=p[i+6]-x,by=p[i+7]-y,bz=p[i+8]-z;
    const up=az*bx-ax*bz;
    if(up<1e-7)continue; // Upward-facing floors, never the ceiling above them.
    const slopeX=(az*by-ay*bz)/up,slopeZ=(ay*bx-ax*by)/up;
    const tri={x,y,z,ax,az,bx,bz,det:-up,slopeX,slopeZ,slope:Math.hypot(slopeX,slopeZ)};
    for(let iz=Math.floor(Math.min(z,z+az,z+bz)/CELL);iz<=Math.floor(Math.max(z,z+az,z+bz)/CELL);iz++)
    for(let ix=Math.floor(Math.min(x,x+ax,x+bx)/CELL);ix<=Math.floor(Math.max(x,x+ax,x+bx)/CELL);ix++) {
     const key=`${chunk.cave}:${ix},${iz}`;
     let cell=this.cells.get(key);if(!cell){cell=[];this.cells.set(key,cell);}cell.push(tri);
    }
   }
  }
 }
 sample(cave,x,z,floor,ceiling) {
  let ground=-Infinity,slope=0;
  for(const t of this.cells.get(`${cave}:${Math.floor(x/CELL)},${Math.floor(z/CELL)}`)||[]) {
   const dx=x-t.x,dz=z-t.z,u=(dx*t.bz-dz*t.bx)/t.det,v=(t.ax*dz-t.az*dx)/t.det;
   if(u<-.00001 || v<-.00001 || u+v>1.00001)continue;
   const y=t.y+t.slopeX*dx+t.slopeZ*dz;
   // Stay in this air interval at stacked passages and junctions.
   if(y<floor-5 || y>floor+8 || y>ceiling-3.5 || y<=ground)continue;
   ground=y;slope=t.slope;
  }
  return Number.isFinite(ground)?{ground,slope}:null;
 }
}
