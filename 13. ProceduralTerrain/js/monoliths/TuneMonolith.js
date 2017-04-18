const tuneMonolithClick = "tuneMonolithClick";

function TuneMonolith(scene, collisionManager) {
	const size = 10;
	var geometry = new THREE.BoxGeometry(size, size, size);
	var material = new THREE.MeshBasicMaterial({color: 0x00ff00});
	var cube = new THREE.Mesh(geometry, material);
	
	cube.position.z = -100;
	cube.position.y = -1;

	scene.add(cube);

	this.mesh = cube;

	this.action = function(mouseDown) {
		if(mouseDown) {
			eventBus.post(tuneMonolithClick);
		}
	}

	this.update = function(time) {
		if(cube.position.y <= 0) {
			const y = collisionManager.getY(cube.position.x, cube.position.z);
			if(y !== null)
				cube.position.y = y + size/2;
		}
	}
}