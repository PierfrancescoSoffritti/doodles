function TerrainSubject(scene) {

	const terrain = new Terrain();
	
	terrain.mesh.rotation.y = Math.PI/2;

	// scene.add(terrain.mesh);

	var size = 100;
	var divisions = 10;
	
	var gridHelper = new THREE.GridHelper( size, divisions );
	scene.add( gridHelper );
	
	this.update = function(time) {
	}
}