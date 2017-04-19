const tuneMonolithClick = "tuneMonolithClick";

function TuneMonolith(geometry, baseSize, scene, collisionManager, index) {
	const self = this;

	this.size = baseSize;
	 
	this.mesh = new THREE.Mesh( geometry, new THREE.MeshStandardMaterial({color: 0x00ff00, shading: THREE.FlatShading}) );
	this.mesh.material.color.setHSL(getRandom(0, 1), .5, .5);
	this.mesh.position.y = -1;

	scene.add(this.mesh);

	this.action = function(mouseDown) {
		if(mouseDown) {
			changeColor();
			bump();
			eventBus.post(tuneMonolithClick, index*2);
		}
	}

	this.update = function(time) {
		if(this.mesh.position.y <= 0) {
			const y = collisionManager.getY(this.mesh.position.x, this.mesh.position.z);
			if(y !== null)
				this.mesh.position.y = y;
		}

		self.mesh.material.emissive.setHSL((Math.sin(time)+3)/4, (Math.sin(time)+3)/4, .2);
	}

	function changeColor() {
		self.mesh.material.color.setHSL(getRandom(0, 1), .5, .5);
	}

	function bump() {
		const mesh = self.mesh;
		const originalScaleY = mesh.scale.y;

		createjs.Tween
			.get(mesh.scale, {override:true})
			.to({y: originalScaleY*1.2 }, 300, createjs.Ease.cubicInOut)
			.call(function() { 
				mesh.scale.y = originalScaleY;
			});
	}
}