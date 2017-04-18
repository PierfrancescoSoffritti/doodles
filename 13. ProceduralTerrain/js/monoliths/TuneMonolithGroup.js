function TuneMonolithGroup(scene, collisionManager) {
	const subjects = [];

	const baseSize = 10;

	var geometry = new THREE.BoxGeometry(baseSize, baseSize, baseSize);
	var material = new THREE.MeshBasicMaterial({color: 0x00ff00});
	var cube = new THREE.Mesh(geometry, material);

	const zOffset = -400;
	
	const radStep = 30;
	let angle = Math.PI/2;
	let radius = radStep;
	let index = 0;
	for(let i=0; i<16; i++) {
		
		const tCube = new TuneMonolith(cube, baseSize, scene, collisionManager, index);
		tCube.mesh.position.set(radius*Math.cos(angle), 0, zOffset + radius*Math.sin(angle));

		subjects.push(tCube);

		if(angle >= Math.PI*2) {
			angle = Math.PI/2;
			radius += radStep;
			index++;
		} else {
			angle += Math.PI/2;
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

			const distance = Math.sqrt(Math.pow(raycaster.ray.origin.x - subjects[i].mesh.position.x, 2) + Math.pow(raycaster.ray.origin.z - subjects[i].mesh.position.z, 2));
			if(distance > subjects[i].size*5)
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