function MonolithsSpawner(scene, player, collisionManager, terrainSize, cubeCamera) {
	const octahedrons = [];
	const monoliths = [];

	for(let i=0; i<4; i++) {
		const x = getRandom(-terrainSize/12, terrainSize/12);
		const z = getRandom(-terrainSize/12, terrainSize/12);

		octahedrons.push(new Octahedron(scene, collisionManager, x, z, cubeCamera))
	}

	monoliths.push(new TuneMonolithGroup(scene, collisionManager, terrainSize))
	monoliths.push(new Sproute(scene, collisionManager, terrainSize))

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

	let isActionAvailable = false;

	this.update = function(time) {
		for(let i=0; i<octahedrons.length; i++)
			octahedrons[i].update(time);
		
		player.controls.getDirection(forwardVector);
		const raycaster = new THREE.Raycaster(player.position, forwardVector)

		for(let i=0; i<monoliths.length; i++) {

			monoliths[i].update(time);

			isActionAvailable = isActionAvailable || monoliths[i].checkCollision(raycaster, mouseDown);
		}

		if(isActionAvailable) {
			eventBus.post(actionAvailable);
			isActionAvailable = false;
		} else {
			eventBus.post(actionUnavailable);
		}

		mouseDown = false;
	}
}