function Trees(scene, player, collisionManager) {

	this.minRadius = 80;
	this.maxRadius = 160;
	this.maxDistance = 180;

	this.height = 20;

	this.player = player;
	this.entities = [];
	this.collisionManager = collisionManager;

	var cube = new THREE.LineSegments(
        new THREE.EdgesGeometry( new THREE.BoxGeometry(4, this.height, 4) ),
        new THREE.LineBasicMaterial()
    );

	for(let i=0; i<20; i++) {
		this.entities.push(cube.clone());
		this.entities[i].animationInProgress = false;
		scene.add(this.entities[i]);
	}
}

Trees.inheritsFrom(FollowerEntity);