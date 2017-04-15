function Trees(scene, player, collisionManager) {
	const self = this;

	this.minRadius = 80;
	this.maxRadius = 160;
	this.maxDistance = 180;
	this.animationTime = 1000;

	this.height = 220;

	this.player = player;
	this.entities = [];
	this.collisionManager = collisionManager;

	var material = new THREE.MeshStandardMaterial({ color: "#000", roughness: .5, metalness: .5, shading: THREE.FlatShading });

    var loader = new THREE.JSONLoader();
    loader.load('models/tree.json', function(geometry) {
        const treeMesh = new THREE.Mesh(geometry);
        treeMesh.material = material;

        for(let i=0; i<20; i++) {
        	const scale = 15//getRandom(10, 20);

			const tree = treeMesh.clone();
			tree.scale.set(scale, scale*1.5, scale);

			self.entities.push(tree);
			self.entities[i].animationInProgress = false;
			scene.add(self.entities[i]);
		}
    });
}

Trees.inheritsFrom(FollowerEntity);