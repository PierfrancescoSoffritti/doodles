// Bounds and child/leaf ranges share numeric storage. Left-before-right traversal
// preserves the original triangle order used by exact collision checks.
export class PackedTriangleBoundsTree {
 constructor(data,defer=false) {
  this.data=data;this.indices=Uint32Array.from({length:data.length/15},(_,i)=>i);
  this.nodes=new Float64Array(1024*10);this.nodeCount=0;this.stack=new Uint32Array(26);
  this.work=this.build();if(!defer)while(!this.work.next().done){}
 }
 *build() {
  const tree=this,data=this.data,indices=this.indices,scratch=new Uint32Array(indices.length);
  function* node(start,count,depth=0) {
   const id=tree.nodeCount++,o=id*10;
   if(o+10>tree.nodes.length){const grown=new Float64Array(tree.nodes.length*2);grown.set(tree.nodes);tree.nodes=grown;}
   let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
   for(let i=start;i<start+count;i++){
    const k=indices[i]*15+9;
    minX=Math.min(minX,data[k]);minY=Math.min(minY,data[k+1]);minZ=Math.min(minZ,data[k+2]);
    maxX=Math.max(maxX,data[k+3]);maxY=Math.max(maxY,data[k+4]);maxZ=Math.max(maxZ,data[k+5]);
    if((i-start)%256===255)yield;
   }
   const a=tree.nodes;a[o]=minX;a[o+1]=minY;a[o+2]=minZ;a[o+3]=maxX;a[o+4]=maxY;a[o+5]=maxZ;a[o+8]=start;a[o+9]=count;
   if(count<=24||depth>=24)return id;
   const x=maxX-minX,y=maxY-minY,z=maxZ-minZ,axis=x>=y&&x>=z?0:y>=z?1:2;
   const middle=axis===0?minX+maxX:axis===1?minY+maxY:minZ+maxZ;
   let leftCount=0;
   for(let i=start;i<start+count;i++){
    const id=indices[i],k=id*15+9+axis;if(data[k]+data[k+3]<middle)scratch[start+leftCount++]=id;
    if((i-start)%256===255)yield;
   }
   if(!leftCount||leftCount===count)return id;
   let right=start+leftCount;
   for(let i=start;i<start+count;i++){
    const id=indices[i],k=id*15+9+axis;if(!(data[k]+data[k+3]<middle))scratch[right++]=id;
    if((i-start)%256===255)yield;
   }
   indices.set(scratch.subarray(start,start+count),start);
   const left=yield*node(start,leftCount,depth+1),rightId=yield*node(start+leftCount,count-leftCount,depth+1);
   tree.nodes[o+6]=left;tree.nodes[o+7]=rightId;return id;
  }
  this.root=yield*node(0,indices.length);this.nodes=this.nodes.slice(0,this.nodeCount*10);
 }
 query(bounds,result=[]) {
  result.length=0;const data=this.data,indices=this.indices,a=this.nodes,lo=bounds.min,hi=bounds.max,stack=this.stack;
  let pending=1;stack[0]=this.root;
  while(pending){
   const o=stack[--pending]*10;
   if(hi.x<a[o]||lo.x>a[o+3]||hi.y<a[o+1]||lo.y>a[o+4]||hi.z<a[o+2]||lo.z>a[o+5])continue;
   if(a[o+7]){stack[pending++]=a[o+7];stack[pending++]=a[o+6];continue;}
   for(let i=a[o+8],end=i+a[o+9];i<end;i++){
    const id=indices[i],k=id*15+9;
    if(data[k+3]<lo.x||data[k]>hi.x||data[k+4]<lo.y||data[k+1]>hi.y||data[k+5]<lo.z||data[k+2]>hi.z)continue;
    result.push(id);
   }
  }
  return result;
 }
}
