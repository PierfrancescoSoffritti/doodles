import * as THREE from 'three';

// Shared silhouettes for the atelier and world population.
export function lilyPetal(length=.68,width=.22){
 const positions=[],indices=[];
 for(let i=0;i<=5;i++){const t=i/5,w=Math.sin(Math.PI*t)*width+.006;for(let j=-1;j<=1;j++)positions.push(t*length,.14*Math.sin(t*Math.PI)+.17*t+(j===0?.035:0),j*w);}
 for(let i=0;i<5;i++)for(let j=0;j<2;j++){const a=i*3+j;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function lilyPad(){
 const shape=new THREE.Shape();shape.moveTo(0,0);
 for(let i=0;i<=24;i++){const a=.16+i/24*(Math.PI*2-.32);shape.lineTo(Math.cos(a),Math.sin(a));}shape.closePath();
 const source=new THREE.ShapeGeometry(shape),g=source.toNonIndexed();source.dispose();const colors=[];
 for(let i=0;i<g.attributes.position.count;i++){const shade=.86+(Math.floor(i/3)%5)*.035;colors.push(shade,shade,shade);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}
