function EntitiesSpawner(scene, player, terrain) {
	
	const material = new THREE.MeshStandardMaterial();
	const geometry = new THREE.IcosahedronGeometry(1, 2);
	const mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	const collisionManager = new TerrainCollisionManager(mesh, terrain);

	const maxRadius = 35;
	const speed = 3;

	this.update = function(time) {
		const angle = -Math.PI/2;
		mesh.position.x = player.position.x + maxRadius * Math.cos(angle);
		mesh.position.z = player.position.z + maxRadius * Math.sin(angle);

		collisionManager.update(time);

		// mesh.material.emissive.g = Math.max(0, (Math.sin(time * speed )));
		mesh.material.emissive.setHSL(Math.sin(time * 0.1), 0.5, 0.5);
	}
}