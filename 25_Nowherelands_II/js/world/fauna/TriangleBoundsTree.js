import * as THREE from 'three';

// Static homes are queried many times per flight. Reject whole branches before
// doing the existing exact triangle-distance tests; collision rules stay intact.
export class TriangleBoundsTree {
 constructor(triangles,defer=false) {
  this.work=this.build(triangles);
  if(!defer)while(!this.work.next().done){}
 }
 *build(triangles) {
  function* node(items,depth=0) {
   const box=new THREE.Box3();
   for(let i=0;i<items.length;i++){box.union(items[i].box);if(i%256===255)yield;}
   if(items.length<=24||depth>=24)return{box,items};
   const size=box.getSize(new THREE.Vector3());
   const axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';
   const middle=box.min[axis]+box.max[axis],left=[],right=[];
   for(let i=0;i<items.length;i++){
    const item=items[i];(item.box.min[axis]+item.box.max[axis]<middle?left:right).push(item);
    if(i%256===255)yield;
   }
   if(!left.length||!right.length)return{box,items};
   return{box,left:yield* node(left,depth+1),right:yield* node(right,depth+1)};
  }
  this.root=yield* node(triangles);
 }
 query(bounds) {
  const result=[];
  const visit = node => {
   if (!node.box.intersectsBox(bounds)) return;
   if (node.items) {
    for (const item of node.items) if (item.box.intersectsBox(bounds)) result.push(item);
   } else { visit(node.left); visit(node.right); }
  };
  visit(this.root);
  return result;
 }
}
