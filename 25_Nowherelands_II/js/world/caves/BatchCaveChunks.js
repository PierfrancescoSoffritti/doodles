// Combine adjacent immutable chunks without changing triangle or vertex words.
export function batchCaveChunks(chunks, maxVertices=16384, maxSpan=128) {
 const result=[];let group=[],count=0,lo=[],hi=[];
 function flush(){
  if(group.length===1)result.push(group[0]);
  else if(group.length){
   const words=new Uint32Array(count*3),index=new Uint16Array(group.reduce((n,c)=>n+(c.index?.length??c.position.length/3),0));let vertex=0,at=0;
   for(const c of group){words.set(new Uint32Array(c.position.buffer,c.position.byteOffset,c.position.length),vertex*3);const n=c.position.length/3;
    if(c.index)for(const i of c.index)index[at++]=vertex+i;else for(let i=0;i<n;i++)index[at++]=vertex+i;
    vertex+=n;
   }
   result.push({cave:group[0].cave,position:new Float32Array(words.buffer),index});
  }
  group=[];count=0;
 }
 for(const c of chunks){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<c.position.length;i++){const axis=i%3,v=c.position[i];min[axis]=Math.min(min[axis],v);max[axis]=Math.max(max[axis],v);}
  const n=c.position.length/3;
  if(group.length&&(c.cave!==group[0].cave||count+n>Math.min(65535,maxVertices)||min.some((v,i)=>Math.max(max[i],hi[i])-Math.min(v,lo[i])>maxSpan)))flush();
  if(!group.length){lo=min;hi=max;}else for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],min[i]);hi[i]=Math.max(hi[i],max[i]);}
  group.push(c);count+=n;
 }
 flush();return result;
}
