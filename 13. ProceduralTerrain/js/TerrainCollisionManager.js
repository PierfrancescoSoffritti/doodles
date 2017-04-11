function TerrainCollisionManager(terrain) {

    this.objects = [];
	
	const down = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster();
    
    let lastLegalPositon;

	this.update = function() {

        for(let i=0; i<this.objects.length; i++) {
            const object = this.objects[i];

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
}