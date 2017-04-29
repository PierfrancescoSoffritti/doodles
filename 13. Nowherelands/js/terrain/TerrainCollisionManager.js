function TerrainCollisionManager(terrain) {

    this.objects = [];
	
	const down = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 400, 0), down)

    this.getY = function(x, z) {
        raycaster.ray.origin.set(x, 400, z);

        const collisionResults = raycaster.intersectObject(terrain);

        if (collisionResults.length > 0)
            return collisionResults[0].point.y;
        else
            return null;
    }
    
	this.update = function() {

        for(let i=0; i<this.objects.length; i++) {
            const object = this.objects[i];

            if(object.skipCollision === true)
                continue;

            const y = this.getY(object.position.x, object.position.z);

            if (y !== null) {
                object.position.y = y+16;
                object.lastLegalPositon = object.position.clone();
            } else {
                if(object.lastLegalPositon)
                    object.position.set(object.lastLegalPositon.x, object.lastLegalPositon.y, object.lastLegalPositon.z);
                else
                    object.position.y++;
            }
        }
	}
}