function TerrainCollisionManager(camera, terrain) {
	
	const down = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster();
    
	this.update = function() {
		raycaster.set(camera.position, down);
        const collisionResults = raycaster.intersectObject(terrain);

        if (collisionResults.length > 0 && collisionResults[0].distance > 0)
            camera.position.y = collisionResults[0].point.y+4;
	}
}