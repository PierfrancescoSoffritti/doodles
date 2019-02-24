function SceneSubject(scene) {
	
	const radius = 2;
	const mesh = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(radius, 2), new THREE.MeshStandardMaterial({ flatShading: true }));

	mesh.position.set(0, 0, -20);

	scene.add(mesh);
	
	this.update = function(time) {
		const scale = Math.sin(time)+2;

		mesh.scale.set(scale, scale, scale);
	}
}