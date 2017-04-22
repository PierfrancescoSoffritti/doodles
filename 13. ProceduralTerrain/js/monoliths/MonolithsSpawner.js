function MonolithsSpawner(scene, player, collisionManager, terrainSize, cubeCamera) {
	const monoliths = [];

	monoliths.push(new TuneMonolithGroup(scene, collisionManager, terrainSize))
	monoliths.push(new Octahedrons(scene, collisionManager, terrainSize, cubeCamera))
	monoliths.push(new TimeMonolith(scene, collisionManager, terrainSize, cubeCamera))

	const forwardVector = new THREE.Vector3();
	const maxDistance = 50;

	let mouseDown = false;

	document.addEventListener("click", function() {
    	mouseDown = true;
	})

	let isActionAvailable = false;
	const raycaster = new THREE.Raycaster(player.position, forwardVector)

	this.update = function(time) {		
		player.controls.getDirection(forwardVector);		
		raycaster.ray.set(player.position, forwardVector);

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