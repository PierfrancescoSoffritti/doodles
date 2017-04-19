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
		tCube.mesh.position.set(xOffset + radius*Math.cos(angle), 0, zOffset + radius*Math.sin(angle));
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

	this.update = function(time) {
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