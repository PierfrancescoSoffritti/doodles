// Exact, bounded memoization of the completed terrain. Water-level changes
// invalidate it; render frames do not change the terrain. Restore every public
// scratch result: callers frequently read water/shore data after sample().
export class HeightSampleCache {
 constructor(heightmap,capacity=4096){
  if(capacity<1||(capacity&(capacity-1)))throw Error('Cache capacity must be a power of two');
  this.hm=heightmap;this.original=heightmap.sample;this.mask=capacity-1;
  this.data=new Float64Array(capacity*15);this.tags=new Uint32Array(capacity);
  this.epoch=1;this.waterLevel=heightmap.waterLevel;this.hits=0;this.misses=0;
  this.sample=(x,z)=>this.read(x,z);heightmap.sample=this.sample;
 }
 reset(){if(++this.epoch===0xffffffff){this.tags.fill(0);this.epoch=1;}this.waterLevel=this.hm.waterLevel;}
 read(x,z){
  const h=this.hm;
  if(h.waterLevel!==this.waterLevel)this.reset();
  const slot=(Math.imul((x*1024)|0,73856093)^Math.imul((z*1024)|0,19349663))&this.mask,k=slot*15,a=this.data;
  if(this.tags[slot]===this.epoch&&Object.is(a[k],x)&&Object.is(a[k+1],z)){
   this.hits++;
   h._water=a[k+3];h._bank=a[k+4];h._foam=a[k+5];h._riverDist=a[k+6];h._riverWidth=a[k+7];h._riverAlong=a[k+8];h._riverAcross=a[k+9];h._riverSeg=a[k+10];h._slope=a[k+11];h._hardness=a[k+12];
   h.lakes.shoreId=a[k+13];h.lakes.shoreDistance=a[k+14];return a[k+2];
  }
  this.misses++;const y=this.original.call(h,x,z);
  this.tags[slot]=this.epoch;a[k]=x;a[k+1]=z;a[k+2]=y;
  a[k+3]=h._water;a[k+4]=h._bank;a[k+5]=h._foam;a[k+6]=h._riverDist;a[k+7]=h._riverWidth;a[k+8]=h._riverAlong;a[k+9]=h._riverAcross;a[k+10]=h._riverSeg;a[k+11]=h._slope;a[k+12]=h._hardness;
  a[k+13]=h.lakes.shoreId;a[k+14]=h.lakes.shoreDistance;return y;
 }
 dispose(){if(this.hm.sample===this.sample)this.hm.sample=this.original;}
}
