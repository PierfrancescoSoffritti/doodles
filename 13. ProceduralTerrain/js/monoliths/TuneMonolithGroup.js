function TuneMonolithGroup(scene, collisionManager, terrainSize) {
	const subjects = [];

	const baseSize = 5;

	var geometry = new THREE.BoxGeometry(baseSize, baseSize*2, baseSize);
	geometry.vertices[0].y /= 1.2
	geometry.vertices[1].y /= 1.2

	const xOffset = getRandom(-terrainSize/12, terrainSize/20);
	const zOffset = getRandom(-terrainSize/6, 0);

	const radStep = 30;
	const angleStep = Math.PI/2;
	let angle = angleStep;
	let radius = radStep;
	let index = 0;
	for(let i=0; i<16; i++) {
		
		const tCube = new TuneMonolith(geometry, baseSize, scene, collisionManager, index);
		tCube.mesh.position.x = xOffset + radius*Math.cos(angle);
		tCube.mesh.position.z = zOffset + radius*Math.sin(angle);
		
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

	const light = new THREE.PointLight("#fff", 1, 200, 2);
	light.position.set(xOffset, -1, zOffset);
	scene.add(light);

	const size = 6;
    const octahedron = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.OctahedronGeometry(size, 0)),
        new THREE.LineBasicMaterial()
    );
    octahedron.position.set(light.position.x, light.position.y, light.position.z);
    scene.add(octahedron);

	let isActionAvailable = false;

	this.update = function(time) {
		// update Y
		if(light.position.y < 0) {
			const y = collisionManager.getY(light.position.x, light.position.z);
			if(y !== null) {
				light.position.y = y+40;
				octahedron.position.y = y+30;
			}
		}

		octahedron.position.y = (light.position.y-10) + Math.sin(time)*2;
		octahedron.rotation.y = time*0.06;

		for(let i=0; i<subjects.length; i++) {
			subjects[i].update(time);
		}
	}

	this.checkCollision = function(raycaster, mouseDown) {
		isActionAvailable = false;

		for(let i=0; i<subjects.length; i++) {

			const distance = raycaster.ray.origin.distanceTo(subjects[i].mesh.position)			
			if(distance > subjects[i].size*8)
				continue;

			const collisionResults = raycaster.intersectObject(subjects[i].mesh);

	        if (collisionResults.length > 0) {
	            subjects[i].action(mouseDown);
	            isActionAvailable = true;
	            break;
	        }
		}

		if(isActionAvailable && mouseDown)
			animateLight();

		return isActionAvailable;
	}

	function animateLight() {
		const tween1 = new TWEEN.Tween(light)
			.to({intensity: 4, distance: 300}, 600)
			.easing(TWEEN.Easing.Cubic.In);

		const tween2 = new TWEEN.Tween(light)
			.to({intensity: 1, distance: 200}, 1000)
			.easing(TWEEN.Easing.Cubic.Out);

		tween1.chain(tween2);
		tween1.start();
	}

}