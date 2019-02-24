function Cylinders(scene) {
	const self = this;

	this.minRadius = 80;
	this.maxRadius = 160;
	this.maxDistance = 180;

	this.height = 15;

	this.entities = [];
	
 	const cylinderGeometry = new THREE.CylinderBufferGeometry(2, 2, this.height, 6);

 	const wireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(cylinderGeometry),
        new THREE.LineBasicMaterial()
    )
	
	const cylinderBig = new THREE.Mesh(cylinderGeometry, new THREE.MeshBasicMaterial({ color: "#000001" }));
	cylinderBig.add(wireframe);

	const cylinderSmall = cylinderBig.clone();
	cylinderSmall.scale.y = 0.5;

	for(let i=0; i<20; i++) {

		const scaleFactor = getRandom(0, 0.6);

		if(i%2 === 0) {

			const wireframeCopy = wireframe.clone()
			wireframeCopy.animationTimeIn = getRandom(250, 350);
			wireframeCopy.animationTimeOut = getRandom(250, 350);

			wireframeCopy.scaleFactor = scaleFactor;

			this.entities.push(wireframeCopy);
		}
		else {
			const group = new THREE.Group();
			const small = cylinderSmall.clone()
			group.add(cylinderBig.clone())
			group.add(small)

			small.position.x -= getRandom(-6, 6);
			small.position.z += getRandom(-6, 4)
			small.position.y -= this.height/4

			group.animationTimeIn = getRandom(250, 350);
			group.animationTimeOut = getRandom(250, 350);

			group.scaleFactor = scaleFactor;

			this.entities.push(group);
		}

		this.entities[i].animationInProgress = false;
		scene.add(this.entities[i]);
	}

	eventBus.subscribe(notePlayed, onNotePlayed)

	function onNotePlayed() {
		self.entities.forEach(function(group) {
			scale(group);
		})
	}

	function scale(target, onComplete) {
		const tween = new TWEEN.Tween(target.scale)
			.to({y: 1.0 + target.scaleFactor}, 300)
			.easing(TWEEN.Easing.Cubic.InOut)
			.onComplete(function() {
				
				const tween = new TWEEN.Tween(target.scale)
					.to({y: 1}, 200)
					.easing(TWEEN.Easing.Cubic.InOut)
					.start();

			})
			.start();
	}
}