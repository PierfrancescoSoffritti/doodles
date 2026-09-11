import { birdDeformation } from '../js/world/fauna/BirdMesh.js?v=outline-2';
import { BirdJourney, BIRD_ANTICIPATION, BIRD_FLIGHT_TIME, BIRD_JOURNEY_TIME } from '../js/world/fauna/BirdJourney.js';

// Run only with ?check=1. Capture the production vertex deformation on the GPU:
// simulation contact targets alone cannot establish that rendered feet stay put.
export function checkBirdRendering(geometry,species=0) {
 const gl=document.createElement('canvas').getContext('webgl2');
 if(!gl)throw new Error('Bird rendering checks require WebGL 2');
 const program=gl.createProgram(),shaders=[],buffers=[];
 const vao=gl.createVertexArray(),feedback=gl.createTransformFeedback();
 try {
  const source=birdDeformation.replace(/attribute /g,'in ');
  for(const [type,code] of [[gl.VERTEX_SHADER,`#version 300 es\nprecision highp float;in vec3 position;out vec3 deformed;${source}\nvoid main(){deformed=deformBird(position);gl_Position=vec4(deformed,1);}`],
   [gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1);}']]){
   const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,code);gl.compileShader(s);
   if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);
  }
  gl.transformFeedbackVaryings(program,['deformed'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);gl.bindVertexArray(vao);
  const positions=geometry.attributes.position.array,parts=geometry.attributes.aPart.array,n=parts.length;
  for(const [name,data,size] of [['position',positions,3],['aPart',parts,1],['aSlender',geometry.attributes.aSlender.array,3],['aCrested',geometry.attributes.aCrested.array,3]]){
   const buffer=gl.createBuffer();buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
   const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);
  }
  const output=gl.createBuffer();buffers.push(output);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,positions.byteLength,gl.DYNAMIC_READ);
  function capture(p){
   gl.vertexAttrib1f(gl.getAttribLocation(program,'aSpecies'),species);
   for(const [name,v] of [['aWing',[p.shoulder,p.wrist,p.fold,p.tail]],['aPose',[p.pitch,p.bank,p.headYaw,p.headPitch]],['aFeet',[p.legs,p.contact,p.footY,0]]]) gl.vertexAttrib4fv(gl.getAttribLocation(program,name),v);
   gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,n);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
   const data=new Float32Array(positions.length);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,data);
   if(data.some(v=>!Number.isFinite(v)))throw new Error('Non-finite bird vertex');return data;
  }
  const j=new BirdJourney();j.start();let maxFootDrift=0,samples=0;
  for(const time of [0,.15,.28,.4,.7,1,1.3,1.5,1.7,1.8,1.92,1.93,2,2.1,BIRD_JOURNEY_TIME]){j.seek(time);capture(j.sample());samples++;}
  for(const [start,end] of [[0,BIRD_ANTICIPATION-.001],[BIRD_ANTICIPATION+BIRD_FLIGHT_TIME,BIRD_JOURNEY_TIME]]){
   let reference;
   for(let time=start;time<=end+1e-8;time+=.01){
    j.seek(time);const p=j.sample(),data=capture(p),feet=[];
    for(let i=0;i<n;i++)if(parts[i]>=7){
     const x=data[i*3],y=data[i*3+1],z=data[i*3+2];
     feet.push(Math.cos(p.yaw)*x+Math.sin(p.yaw)*z+p.position.x,y+p.position.y,-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z+p.position.z);
    }
    if(!reference)reference=feet;
    for(let i=0;i<feet.length;i++)maxFootDrift=Math.max(maxFootDrift,Math.abs(feet[i]-reference[i]));samples++;
   }
  }
  const idle=new BirdJourney();let idleFeet,minBeakY=Infinity,maxBeakY=-Infinity;
  const beakIndices=[];for(let i=0;i<n;i++)if(parts[i]===1&&positions[i*3]>.70)beakIndices.push(i);
  for(let frame=0;frame<300;frame++){
   const p=idle.update(.03),data=capture(p),feet=[];
   for(let i=0;i<n;i++)if(parts[i]>=7)feet.push(data[i*3]+p.position.x,data[i*3+1]+p.position.y,data[i*3+2]+p.position.z);
   if(!idleFeet)idleFeet=feet;
   for(let i=0;i<feet.length;i++)maxFootDrift=Math.max(maxFootDrift,Math.abs(feet[i]-idleFeet[i]));
   for(const i of beakIndices){const y=data[i*3+1]+p.position.y;minBeakY=Math.min(minBeakY,y);maxBeakY=Math.max(maxBeakY,y);}samples++;
  }
  if(!beakIndices.length||minBeakY<-.02||minBeakY>.06||maxBeakY-minBeakY<.35)throw new Error(`Peck misses the ground: ${minBeakY}–${maxBeakY}`);
  if(maxFootDrift>.0001)throw new Error(`Bird feet slide during contact (${maxFootDrift})`);
  j.seek(1.3);const open=capture(j.sample());j.seek(BIRD_JOURNEY_TIME);const folded=capture(j.sample());
  const span=data=>{const zs=[];for(let i=0;i<n;i++)if(parts[i]===2||parts[i]===3)zs.push(data[i*3+2]);return Math.max(...zs)-Math.min(...zs);};
  if(span(open)<span(folded)*3)throw new Error('Wings do not fold against the body');
  return {species,samples,vertices:n,triangles:n/3,maxFootDrift,minBeakY,maxBeakY,openSpan:span(open),foldedSpan:span(folded)};
 } finally {
  buffers.forEach(b=>gl.deleteBuffer(b));shaders.forEach(s=>gl.deleteShader(s));gl.deleteVertexArray(vao);gl.deleteTransformFeedback(feedback);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();
 }
}
