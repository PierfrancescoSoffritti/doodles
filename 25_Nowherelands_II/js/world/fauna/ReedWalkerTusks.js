import * as THREE from 'three';

// A continuous tapered curve emerges from inside the husk, without a socket ring.
export function reedTusks(traits, surface) {
 const root = new THREE.Group();
 if (!traits.tuskLength) return root;
 const material = new THREE.MeshStandardMaterial({ color: '#c0b595', roughness: .82 });
 for (const tusk of traits.tusks) {
  const { side } = tusk;
  const ray = new THREE.Raycaster(new THREE.Vector3(traits.length + 2, -.19, side * traits.width * .56), new THREE.Vector3(-1, 0, 0));
  const hit = ray.intersectObject(surface)[0];
  const base = hit.point.clone(); base.x -= .09;
  const length = tusk.length;
  const curve = new THREE.CatmullRomCurve3([
   base,
   base.clone().add(new THREE.Vector3(length * .34, -length * .028, side * length * tusk.spread * .36)),
   base.clone().add(new THREE.Vector3(length * .78, length * tusk.rise * .22, side * length * tusk.spread * .76)),
   base.clone().add(new THREE.Vector3(length, length * tusk.rise, side * length * tusk.spread)),
  ]);
  const segments = 28, radial = 8, frames = curve.computeFrenetFrames(segments, false), positions = [], indices = [];
  for (let i = 0; i <= segments; i++) {
   const t = i / segments, point = curve.getPointAt(t);
   const radius = tusk.tip + (tusk.radius - tusk.tip) * (1 - t) ** tusk.taper;
   for (let j = 0; j <= radial; j++) {
    const angle = j / radial * Math.PI * 2;
    const vertex = point.clone().addScaledVector(frames.normals[i], Math.cos(angle) * radius).addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
    positions.push(vertex.x, vertex.y, vertex.z);
    if (i < segments && j < radial) {
     const a = i * (radial + 1) + j, b = a + radial + 1;
     indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
   }
  }
  // Seal the tip, including the visibly blunter ends on weathered short tusks.
  const tip = curve.getPointAt(1), tipIndex = positions.length / 3;
  positions.push(tip.x, tip.y, tip.z);
  for (let j = 0; j < radial; j++) indices.push(tipIndex, segments * (radial + 1) + j, segments * (radial + 1) + j + 1);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; root.add(mesh);
 }
 return root;
}
