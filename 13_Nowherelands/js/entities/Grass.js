function Grass(scene) {

	this.minRadius = 40;
	this.maxRadius = 160;
	this.maxDistance = 180;

	this.height = 4;

	this.entities = [];

	const grassBlueprint = new THREE.LineSegments(
        new THREE.EdgesGeometry( new THREE.CylinderBufferGeometry(.2, .4, this.height, 2) ),
        new THREE.LineBasicMaterial()
    );
    
    const grassBlueprintSmall = grassBlueprint.clone();
    grassBlueprintSmall.scale.y = 0.5;

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