function SceneSubject(scene) {
	
	const radius = 2;
	const sphere = new THREE.Mesh(
		new THREE.IcosahedronBufferGeometry(radius, 2),
		 new THREE.MeshStandardMaterial({ flatShading: true })
	);

	sphere.position.set(0, 0, -20);
	// scene.add(sphere);

	const box = new THREE.Mesh(
		new THREE.BoxGeometry(0.2, 0.8, 0.6), 
		new THREE.MeshStandardMaterial({ color: "#000" })
	)
	box.position.set(0, 0, -2);
	// scene.add(box)

	const b1 = box.clone()
	b1.position.set(-0.8, -0.5, -2);
	scene.add(b1)

	const b2 = box.clone()
	b2.position.set(1.2, -0.5, -4);
	scene.add(b2)
	
	const b3 = box.clone()
	b3.position.set(-1, -0.5, -5);
	scene.add(b3)

	this.update = function(time) {
		const scale = Math.sin(time)+2;
		box.rotation.y = time/2
		box.position.z -= (Math.sin(time)/6)
		sphere.scale.set(scale, scale, scale);
	}
}