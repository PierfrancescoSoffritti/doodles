function TerrainCollisionManager(object, terrain) {
	
	const down = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster();
    
    let lastLegalPositon;

	this.update = function() {
		raycaster.set(object.position, down);
        const collisionResults = raycaster.intersectObject(terrain);

        if (collisionResults.length > 0) {
            object.position.y = collisionResults[0].point.y+16;
        	lastLegalPositon = object.position.clone();
        } else {
        	// no terrain        	
        	if(lastLegalPositon)
        		object.position.set(lastLegalPositon.x, lastLegalPositon.y, lastLegalPositon.z);
        	else
        		object.position.y++;
        }
	}
}