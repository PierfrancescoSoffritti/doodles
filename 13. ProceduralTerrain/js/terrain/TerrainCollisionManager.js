function TerrainCollisionManager(terrain) {

    this.objects = [];
	
	const down = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster();

    this.getY = function(x, z) {
        raycaster.set(new THREE.Vector3(x, 200, z), down);
        const collisionResults = raycaster.intersectObject(terrain);

        if (collisionResults.length > 0) 
            return collisionResults[0].point.y;
        else {
            console.log("null")
            return null;
        }
    }
    
	this.update = function() {

        for(let i=0; i<this.objects.length; i++) {
            const object = this.objects[i];

            if(object.skipCollision === true)
                continue;

    		raycaster.set(object.position, down);
            const collisionResults = raycaster.intersectObject(terrain);

            if (collisionResults.length > 0) {
                object.position.y = collisionResults[0].point.y+16;
            	object.lastLegalPositon = object.position.clone();
            } else {
            	// no terrain        	
            	if(object.lastLegalPositon)
            		object.position.set(object.lastLegalPositon.x, object.lastLegalPositon.y, object.lastLegalPositon.z);
            	else
            		object.position.y++;
            }
        }
	}
}