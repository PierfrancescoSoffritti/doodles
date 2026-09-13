import { Random } from '../../core/Random.js';

// A compact graph stream preserves aliases and full Float64 state without
// allocating a JSON record/object for every reference and every number.
const MAGIC=0x3243504c;
class Reference { constructor(id){this.id=id;} }
const cache=new WeakMap();
function lakeNodes(lakes){
 if(cache.has(lakes))return cache.get(lakes);
 const nodes=[],indices=new Map();
 const visit=v=>{if(!v||typeof v!=='object'||indices.has(v))return;indices.set(v,nodes.length);nodes.push(v);for(const x of Object.values(v))visit(x);};
 visit(lakes);const result={nodes,indices};cache.set(lakes,result);return result;
}

export function encodeCheckpoint(state,lakes,reusable){
 const work=buildCheckpoint(state,lakes,reusable);let result;do{result=work.next();}while(!result.done);return result.value;
}
export function* buildCheckpoint(state,lakes,reusable){
 const statics=lakeNodes(lakes).indices, seen=new Map(), objects=[], strings=[], stringIds=new Map();
 let buffer=reusable || new ArrayBuffer(262144), view=new DataView(buffer), at=12;
 const reserve=n=>{if(at+n<=buffer.byteLength)return;const next=new ArrayBuffer(Math.max(buffer.byteLength*2,at+n));new Uint8Array(next).set(new Uint8Array(buffer));buffer=next;view=new DataView(buffer);};
 const byte=n=>{view.setUint8(at++,n);};
 const uint=n=>{view.setUint32(at,n,true);at+=4;};
 const stringId=s=>{let id=stringIds.get(s);if(id===undefined){id=strings.length;strings.push(s);stringIds.set(s,id);}return id;};
 const value=v=>{
  if(typeof v==='number'){view.setUint8(at,4);view.setFloat64(at+1,v,true);at+=9;return;}
  if(v===undefined){byte(0);return;}if(v===null){byte(1);return;}
  if(v===false){byte(2);return;}if(v===true){byte(3);return;}
  if(typeof v==='string'){byte(5);uint(stringId(v));return;}
  if(statics.has(v)){byte(7);uint(statics.get(v));return;}
  if(typeof v!=='object')throw Error('Unsupported checkpoint value');
  let id=seen.get(v);if(id===undefined){id=objects.length;objects.push(v);seen.set(v,id);}
  byte(6);uint(id);
 };
 reserve(9);value(state);
 for(let i=0;i<objects.length;i++){
  const object=objects[i],kind=Array.isArray(object)?1:object instanceof Map?2:object instanceof Set?3:object instanceof Random?4:0;
  if(kind===1){reserve(5+9*object.length);byte(kind);uint(object.length);for(const item of object)value(item);}
  else if(kind===2){reserve(5+18*object.size);byte(kind);uint(object.size);for(const[k,v]of object){value(k);value(v);}}
  else if(kind===3){reserve(5+9*object.size);byte(kind);uint(object.size);for(const item of object)value(item);}
  else {const keys=Object.keys(object).filter(k=>typeof object[k]!=='function');reserve(5+13*keys.length);byte(kind);uint(keys.length);for(const key of keys){uint(stringId(key));value(object[key]);}}
  if(i%64===63)yield;
 }
 const table=at;reserve(4);uint(strings.length);
 for(let k=0;k<strings.length;k++){const string=strings[k];reserve(4+string.length*2);uint(string.length);for(let i=0;i<string.length;i++){view.setUint16(at,string.charCodeAt(i),true);at+=2;}if(k%64===63)yield;}
 view.setUint32(0,MAGIC,true);view.setUint32(4,objects.length,true);view.setUint32(8,table,true);
 return reusable ? buffer : buffer.slice(0,at);
}

export function decodeCheckpoint(buffer,lakes){
 const view=new DataView(buffer),statics=lakeNodes(lakes).nodes;
 if(view.getUint32(0,true)!==MAGIC)throw Error('Unsupported checkpoint format');
 const count=view.getUint32(4,true),table=view.getUint32(8,true),strings=[];
 let at=table;
 const uint=()=>{const n=view.getUint32(at,true);at+=4;return n;};
 const stringCount=uint();
 for(let i=0;i<stringCount;i++){const size=uint();let string='';for(let j=0;j<size;j++){string+=String.fromCharCode(view.getUint16(at,true));at+=2;}strings.push(string);}
 at=12;
 const value=()=>{const tag=view.getUint8(at++);switch(tag){
  case 0:return undefined;case 1:return null;case 2:return false;case 3:return true;
  case 4:{const n=view.getFloat64(at,true);at+=8;return n;}
  case 5:return strings[uint()];case 6:return new Reference(uint());case 7:return statics[uint()];
  default:throw Error('Invalid checkpoint value');
 }};
 const root=value(),objects=[],records=[];
 for(let i=0;i<count;i++){
  const kind=view.getUint8(at++),size=uint(),data=[];
  objects.push(kind===1?[]:kind===2?new Map():kind===3?new Set():kind===4?Object.create(Random.prototype):{});
  for(let j=0;j<size;j++){
   if(kind===0||kind===4)data.push([strings[uint()],value()]);
   else if(kind===2)data.push([value(),value()]);else data.push(value());
  }
  records.push({kind,data});
 }
 if(at!==table)throw Error('Invalid checkpoint size');
 // References are tagged wrappers allocated only on recovery, never per frame.
 const resolve=v=>v instanceof Reference?objects[v.id]:v;
 records.forEach(({kind,data},i)=>{const object=objects[i];
  if(kind===0||kind===4)for(const[k,v]of data)object[k]=resolve(v);
  else if(kind===1)for(const v of data)object.push(resolve(v));
  else if(kind===2)for(const[k,v]of data)object.set(resolve(k),resolve(v));
  else for(const v of data)object.add(resolve(v));
 });
 return resolve(root);
}
