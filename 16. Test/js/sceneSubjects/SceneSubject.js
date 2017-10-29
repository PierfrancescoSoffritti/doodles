function SceneSubject(scene) {
	
	const radius = 2;
	const mesh = new THREE.Mesh(new THREE.CircleBufferGeometry(radius, 16), 
		new THREE.MeshBasicMaterial( { color: "#000" } ) );

	mesh.position.set(0, 0, -20);

	scene.add(mesh);
	
	this.update = function(time) {
		const scale = Math.sin(time)+2;

		mesh.scale.set(scale, scale, scale);
	}
}