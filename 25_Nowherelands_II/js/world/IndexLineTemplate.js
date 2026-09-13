// One plant template can repeat an endpoint many times. Preserve full numeric
// coordinates, signed zero and segment order while transforming each point once.
const templates=new WeakMap();
export function indexLineTemplate(source) {
 let template=templates.get(source);if(template)return template;
 const positions=[],indices=[],seen=new Map();
 const key=v=>Object.is(v,-0)?'-0':String(v);
 for(let i=0;i<source.length;i+=3){
  const id=key(source[i])+','+key(source[i+1])+','+key(source[i+2]);
  let index=seen.get(id);
  if(index===undefined){index=positions.length/3;seen.set(id,index);positions.push(source[i],source[i+1],source[i+2]);}
  indices.push(index);
 }
 template={positions:new Float64Array(positions),indices:new Uint32Array(indices)};
 templates.set(source,template);return template;
}
