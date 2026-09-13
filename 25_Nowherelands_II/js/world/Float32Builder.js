// Build GPU attributes directly in typed storage. Fixed-arity writes avoid
// temporary argument arrays and growing boxed-number arrays during streaming.
export class Float32Builder {
 constructor(capacity=4096){this.array=new Float32Array(capacity);this.length=0;}
 reserve(count){
  if(this.length+count<=this.array.length)return;
  const next=new Float32Array(Math.max(this.length+count,this.array.length*2));
  next.set(this.array);this.array=next;
 }
 push3(a,b,c){this.reserve(3);const i=this.length,v=this.array;v[i]=a;v[i+1]=b;v[i+2]=c;this.length+=3;}
 push4(a,b,c,d){this.reserve(4);const i=this.length,v=this.array;v[i]=a;v[i+1]=b;v[i+2]=c;v[i+3]=d;this.length+=4;}
 finish(){const result=this.array.slice(0,this.length);this.array=null;return result;}
}
