import {packWords,unpackWords} from './StaticWords.js?v=stable-30-21';

// Static water is animated in shaders. Retain an exact, smaller CPU copy after
// its first GPU upload. A context rebuild can read the original attribute API.
export function compactStaticWater(roots) {
 const seen=new Set(),pending=[],stats={before:0,after:0,raw:0,decoded:0,attributes:0};
 for(const root of roots)root?.traverse(object=>{
  if(!object.geometry)return;
  for(const attribute of Object.values(object.geometry.attributes)){
   if(seen.has(attribute))continue;seen.add(attribute);
   const array=attribute.array;
   if(array.BYTES_PER_ELEMENT!==4||array.byteLength<4096)continue;
   const packed=packWords(array,attribute.itemSize);
   stats.before+=array.byteLength;
   if(packed.byteLength>=array.byteLength*.9){stats.after+=array.byteLength;continue;}
   stats.after+=packed.byteLength;stats.raw+=array.byteLength;stats.attributes++;
   const length=array.length,Type=array.constructor,stride=attribute.itemSize,bytes=array.byteLength,oldUpload=attribute.onUploadCallback;
   let raw=array,uploaded=false,queued=false;
   const release=()=>{queued=false;if(uploaded&&raw){raw=null;stats.raw-=bytes;}};
   Object.defineProperty(attribute,'array',{configurable:true,get(){
    if(!raw){raw=unpackWords(packed,length,stride,Type);stats.raw+=bytes;stats.decoded++;}
    if(uploaded&&!queued){queued=true;queueMicrotask(release);}
    return raw;
   }});
   attribute.onUploadCallback=function(){oldUpload.call(this);uploaded=true;release();};
   pending.push(()=>{if(uploaded)return;Object.defineProperty(attribute,'array',{configurable:true,writable:true,enumerable:true,value:raw});attribute.onUploadCallback=oldUpload;stats.raw-=bytes;stats.after+=bytes-packed.byteLength;stats.attributes--;});
  }
 });
 // A buffer not drawn in the first view keeps its ordinary CPU copy; do not
 // retain two copies indefinitely or add decompression to its first-use cost.
 Object.defineProperty(stats,'finishWarmup',{value:()=>{for(const finish of pending)finish();pending.length=0;}});
 return stats;
}
