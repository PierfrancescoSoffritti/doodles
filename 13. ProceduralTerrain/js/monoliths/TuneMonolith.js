const tuneMonolithClick = "tuneMonolithClick";

function TuneMonolith(bluePrint, baseSize, scene, collisionManager, index) {
	const self = this;

	this.size = baseSize;
	
	// cube.position.z = -100;
	// cube.position.y = -1;
	 
	this.mesh = bluePrint.clone();
	this.mesh.position.y = -1;
	
	this.mesh.material = new THREE.MeshBasicMaterial({color: 0x00ff00});

	scene.add(this.mesh);

	this.action = function(mouseDown) {
		if(mouseDown) {
			animateColor();
			console.log("called")
			eventBus.post(tuneMonolithClick, index*2);
		}
	}

	this.update = function(time) {
		if(this.mesh.position.y <= 0) {
			const y = collisionManager.getY(this.mesh.position.x, this.mesh.position.z);
			if(y !== null)
				this.mesh.position.y = y + this.size/2;
		}
	}

	function animateColor() {
		console.log(self.mesh.position)
		self.mesh.material.color.setHSL(getRandom(0, 1), .5, .5);
	}
}