function TuneMonolith(scene, collisionManager) {
	const size = 10;
	var geometry = new THREE.BoxGeometry(size, size, size);
	var material = new THREE.MeshBasicMaterial({color: 0x00ff00});
	var cube = new THREE.Mesh(geometry, material);
	scene.add(cube);

	this.action = function() {
	}

	this.update = function(time) {
	}
}