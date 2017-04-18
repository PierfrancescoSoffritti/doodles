const tuneMonolithClick = "tuneMonolithClick";

function TuneMonolith(geometry, baseSize, scene, collisionManager, index) {
	const self = this;

	this.size = baseSize;
	 
	this.mesh = new THREE.Mesh( geometry, new THREE.MeshStandardMaterial({color: 0x00ff00, shading: THREE.FlatShading}) );
	this.mesh.position.y = -1;

	scene.add(this.mesh);

	this.action = function(mouseDown) {
		if(mouseDown) {
			animateColor();
			eventBus.post(tuneMonolithClick, index*2);
		}
	}

	this.update = function(time) {
		if(this.mesh.position.y <= 0) {
			const y = collisionManager.getY(this.mesh.position.x, this.mesh.position.z);
			if(y !== null)
				this.mesh.position.y = y;
		}

		self.mesh.material.emissive.setHSL(Math.sin(time * 0.1), Math.sin(time), .5);
	}

	function animateColor() {
		self.mesh.material.color.setHSL(getRandom(0, 1), .5, .5);
	}
}