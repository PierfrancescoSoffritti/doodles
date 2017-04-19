function Sproute(scene, collisionManager, terrainSize) {
	
	const material = new THREE.MeshBasicMaterial({color: "#00ff00"})
	const geometry = new THREE.IcosahedronGeometry(8, 1);
	const mesh = new THREE.Mesh(geometry, material);

	const maxHeight = getRandom(40, 50);

	mesh.position.set(0, 50, -100);

	scene.add(mesh);

	this.update = function(time) {	
		// todo	
		mesh.position.y = ((Math.sin(time)+8) / 9) * maxHeight;

		const scale = (Math.sin(time)+8)/9;
		mesh.scale.set(scale, scale, scale);
	}

	this.checkCollision = function(raycaster, mouseDown) {
	}

	// behaviour: translate y and scale x y z at each note, go up fast and go down slower
}