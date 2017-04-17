function MonolithsSpawner(scene, player, collisionManager, terrainSize, cubeCamera) {
	const octahedrons = [];
	const monoliths = [];

	for(let i=0; i<4; i++) {
		const x = getRandom(-terrainSize/12, terrainSize/12);
		const z = getRandom(-terrainSize/12, terrainSize/12);

		octahedrons.push(new Octahedron(scene, collisionManager, x, z, cubeCamera))
	}

	monoliths.push(new TuneMonolith(scene, collisionManager))

	const forwardVector = new THREE.Vector3();
	const maxDistance = 50;

	let mouseDown = false;

	document.addEventListener("click", function() {
    	mouseDown = true;
	})

	document.addEventListener("mousedown", function() {
    	// mouseDown = true;
	})

	document.addEventListener("mouseup", function() {
    	// mouseDown = false;
	})

	this.update = function(time) {
		for(let i=0; i<octahedrons.length; i++)
			octahedrons[i].update(time);
		
		player.controls.getDirection(forwardVector);
		const raycaster = new THREE.Raycaster(player.position, forwardVector)
		for(let i=0; i<monoliths.length; i++) {

			monoliths[i].update(time);

			// const distance = Math.sqrt(Math.pow(player.position.x - monoliths[0].mesh.position.x, 2) + Math.pow(player.position.z - monoliths[0].mesh.position.z, 2));
			// if(distance > maxDistance)
			// 	continue;

	        const collisionResults = raycaster.intersectObject(monoliths[0].mesh);

	        if (collisionResults.length > 0)
	            monoliths[0].action(mouseDown);
		}

		mouseDown = false;
	}
}