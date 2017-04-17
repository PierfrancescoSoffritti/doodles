function Grass(scene, player, collisionManager) {

	this.minRadius = 40;
	this.maxRadius = 160;
	this.maxDistance = 180;

	this.height = 4;

	this.player = player;
	this.entities = [];
	this.collisionManager = collisionManager;

	const material = new THREE.LineBasicMaterial();

	const grassBlueprint = new THREE.LineSegments(
        new THREE.EdgesGeometry( new THREE.CylinderGeometry(.2, .4, this.height, 2) ),
        material
    );
    const grassBlueprintSmall = new THREE.LineSegments(
        new THREE.EdgesGeometry( new THREE.CylinderGeometry(.2, .4, this.height/2, 2) ),
        material
    );

	for(let i=0; i<40; i++) {
		const grassBig = grassBlueprint.clone();
		const grassSmall = grassBlueprintSmall.clone();
		const grassSmall2 = grassBlueprintSmall.clone();

		grassSmall.position.x -= getRandom(0, 3);
	    grassSmall.position.y -= this.height/4
	    grassSmall.position.z -= getRandom(-3, 3);

	    grassSmall2.position.x -= getRandom(-4, 0);
	    grassSmall2.position.y -= this.height/4
	    grassSmall2.position.z -= getRandom(-4, 4);

	    const group = new THREE.Group()
	    group.add(grassBig)
	    group.add(grassSmall)
	    group.add(grassSmall2)
	    group.rotation.y = getRandom(0, Math.PI*2);

	    group.animationTimeIn = getRandom(250, 350);
		group.animationTimeOut = getRandom(250, 350);

		this.entities.push(group);
		this.entities[i].animationInProgress = false;
		scene.add(this.entities[i]);
	}
}

Grass.inheritsFrom(FollowerEntity);