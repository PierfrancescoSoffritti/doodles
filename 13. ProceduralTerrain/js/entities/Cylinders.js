function Cylinders(scene, player, collisionManager) {

	this.minRadius = 80;
	this.maxRadius = 160;
	this.maxDistance = 180;
	this.animationTime = 300;

	this.height = 15;

	this.player = player;
	this.entities = [];
	this.collisionManager = collisionManager;
	
 	const wireframeMaterial = new THREE.LineBasicMaterial();

 	const wireframeBig = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.CylinderGeometry(2, 2, this.height, 6)),
        wireframeMaterial
    );
    const wireframeSmall = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.CylinderGeometry(2, 2, this.height/2, 6)),
        wireframeMaterial
    );

 	var material = new THREE.MeshBasicMaterial({ color: "#000001" });

    var geometryBig = new THREE.CylinderGeometry(2, 2, this.height, 6);
    var geometrySmall = new THREE.CylinderGeometry(2, 2, this.height/2, 6);
	
	var cylinderBig = new THREE.Mesh(geometryBig, material);
	cylinderBig.add(wireframeBig);

	var cylinderSmall = new THREE.Mesh(geometrySmall, material);
	cylinderSmall.add(wireframeSmall)

	for(let i=0; i<20; i++) {
		if(i%2 === 0)
			this.entities.push(wireframeBig.clone());
		else {
			const small = cylinderSmall.clone()
			const group = new THREE.Group();
			group.add(cylinderBig.clone())
			group.add(small)

			small.position.x -= getRandom(-6, 6);
			small.position.z += getRandom(-6, 4)
			small.position.y -= this.height/4

			this.entities.push(group);
		}

		this.entities[i].animationInProgress = false;
		scene.add(this.entities[i]);
	}
}

Cylinders.inheritsFrom(FollowerEntity);