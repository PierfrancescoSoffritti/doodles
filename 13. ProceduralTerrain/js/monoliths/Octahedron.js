function Octahedron(scene, collisionManager, x, z, cubeCamera) {
	const size = getRandom(5, 15);

	var geometry = new THREE.OctahedronGeometry(size, 0);
	var material = new THREE.MeshBasicMaterial();
	var main = new THREE.Mesh(geometry, material);
	scene.add(main);

	material.envMap = cubeCamera.renderTarget.texture;

	this.mesh = main;

	main.position.x = x;
	main.position.z = z;	
	main.position.y = -1;

	const small1 = main.clone();
	small1.geometry = new THREE.OctahedronGeometry(size/4, 0)
	scene.add(small1)

	const small2 = small1.clone();
	scene.add(small2)

	const rad = size;
	const speed1 = 1;
	const speed2 = .5;

	this.action = function() {
	}

	this.update = function(time) {
		if(main.position.y <= 0) {
			const y = collisionManager.getY(main.position.x, main.position.z);
			if(y !== null)
				main.position.y = y + size*2;
		}

		material.color.setHSL(Math.sin(time*0.1), 0.5, 0.5);

		const ang1 = time/2;
		const ang2 = time/4;
		small1.position.x = main.position.x + rad * Math.sin(ang1) * Math.cos(ang2)
		small1.position.y = main.position.y + rad * Math.sin(ang1) * Math.sin(ang2)
		small1.position.z = main.position.z + rad * Math.cos(ang1)

		small2.position.x = main.position.x + rad * Math.sin(-ang1*speed2) * Math.cos(-ang2*speed2)
		small2.position.y = main.position.y + rad * Math.sin(-ang1*speed2) * Math.sin(-ang2*speed2)
		small2.position.z = main.position.z + rad * Math.cos(-ang1*speed2)

		const scale = (Math.sin(time*0.6)+6)/7;
		main.scale.set(scale, scale, scale);
	}
}