function Trees(scene) {
	const self = this;

	this.minRadius = 160;
	this.maxRadius = 260;
	this.maxDistance = 265;

	this.height = 220;

	this.entities = [];

	var material = new THREE.MeshStandardMaterial({ color: "#000", roughness: .5, metalness: .5, shading: THREE.FlatShading });

    var loader = new THREE.JSONLoader();
    loader.load('models/tree.json', function(geometry) {
        const treeMesh = new THREE.Mesh(geometry, material);

        for(let i=0; i<20; i++) {
        	const scale = 15//getRandom(10, 20);

			const tree = treeMesh.clone();
			tree.scale.set(scale, scale*1.5, scale);

			const rand = getRandom(3000, 4000);
			tree.position.set(rand, 0, rand);

			tree.animationTimeIn = getRandom(600, 800);
			tree.animationTimeOut = getRandom(600, 800);

			self.entities.push(tree);
			self.entities[i].animationInProgress = false;
			scene.add(self.entities[i]);
		}
    });
}