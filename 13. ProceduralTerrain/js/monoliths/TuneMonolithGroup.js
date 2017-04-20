function TuneMonolithGroup(scene, collisionManager, terrainSize) {
	const subjects = [];

	const baseSize = 5;

	var geometry = new THREE.BoxGeometry(baseSize, baseSize*2, baseSize);
	geometry.vertices[0].y /= 1.2
	geometry.vertices[1].y /= 1.2

	const xOffset = getRandom(-terrainSize/12, terrainSize/12);
	const zOffset = getRandom(-terrainSize/12, terrainSize/12);
	
	// const xOffset = -10;
	// const zOffset = -100;

	const radStep = 30;
	const angleStep = Math.PI/2;
	let angle = angleStep;
	let radius = radStep;
	let index = 0;
	for(let i=0; i<16; i++) {
		
		const tCube = new TuneMonolith(geometry, baseSize, scene, collisionManager, index);
		tCube.mesh.position.set(xOffset + radius*Math.cos(angle), -1, zOffset + radius*Math.sin(angle));
		tCube.mesh.rotation.y = -angle;
		tCube.mesh.scale.y = (4 - index) + 1;

		subjects.push(tCube);

		if(angle >= Math.PI*2) {
			angle = angleStep;
			radius += radStep;
			index++;
		} else {
			angle += angleStep;
		}
	}

	// ADD SOME DUST PARTICLES

	// const light = new THREE.PointLight("#fff", .1);
	// light.position.set(xOffset, -1, zOffset);
	// scene.add(light);

	// const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), new THREE.MeshBasicMaterial({color: "#00ff00"}));
	// scene.add(mesh)
	// mesh.position.set(xOffset, -1, zOffset);

	this.update = function(time) {
		// if(mesh.position.y <= 0) {
		// 	const y = collisionManager.getY(mesh.position.x, mesh.position.z);
		// 	if(y !== null) {
		// 		mesh.position.y = y+20;
		// 		light.position.y = y+20;
		// 	}
		// }

		for(let i=0; i<subjects.length; i++) {
			subjects[i].update(time);
		}
	}

	this.checkCollision = function(raycaster, mouseDown) {
		let isActionAvailable = false;

		for(let i=0; i<subjects.length; i++) {

			const distance = raycaster.ray.origin.distanceTo(subjects[i].mesh.position)			
			if(distance > subjects[i].size*6)
				continue;

			const collisionResults = raycaster.intersectObject(subjects[i].mesh);

	        if (collisionResults.length > 0) {
	            subjects[i].action(mouseDown);
	            isActionAvailable = true;

	            break;
	        }
		}

		return isActionAvailable;
	}

}