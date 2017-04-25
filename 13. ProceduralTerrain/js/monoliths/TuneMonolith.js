const tuneMonolithClick = "tuneMonolithClick";

function TuneMonolith(geometry, baseSize, scene, collisionManager, index) {
	const self = this;

	this.size = baseSize;
	 
	this.mesh = new THREE.Mesh( geometry, new THREE.MeshStandardMaterial({color: 0x00ff00, shading: THREE.FlatShading}) );
	this.mesh.material.color.setHSL(getRandom(0, 1), .5, .5);
	this.mesh.position.y = -1;

	let animating = false;
	let luminosityFact = 0;

	scene.add(this.mesh);

	this.action = function(mouseDown) {
		if(animating)
			return;

		if(mouseDown) {
			changeColor();
			bump();
			eventBus.post(tuneMonolithClick, index*4);
		}
	}

	this.update = function(time) {
		// update y
		if(self.mesh.position.y < 0) {
			const y = collisionManager.getY(self.mesh.position.x, self.mesh.position.z);
			if(y !== null) {
				self.mesh.position.y = y;
			}
		}

		luminosityFact = animating ? .3 : 0;
		self.mesh.material.emissive.setHSL((Math.sin(time/2)+3)/4, (Math.sin(time/4)+3)/4, .2 + luminosityFact);
	}

	function changeColor() {
		self.mesh.material.color.setHSL(getRandom(0, 1), .5, .5);
	}

	function bump() {		
		animating = true;

		const mesh = self.mesh;
		const originalScaleZ = mesh.scale.z;
		const originalScaleY = mesh.scale.y;

		const tween1 = new TWEEN.Tween(mesh.scale)
			.to({y: originalScaleY*1.05, z: originalScaleZ*1.05}, 100)
			.easing(TWEEN.Easing.Cubic.In);

		const tween2 = new TWEEN.Tween(mesh.scale)
			.to({y: originalScaleY, z: originalScaleZ}, 50)
			.easing(TWEEN.Easing.Cubic.Out)
			.onComplete(function () {
				animating = false;
			});

		tween1.chain(tween2);
		tween1.start();


		// createjs.Tween
		// 	.get(mesh.scale, {override:true})
		// 	.to({y: originalScaleY*1.05, z: originalScaleZ*1.05}, 100, createjs.Ease.cubicIn)
		// 	.call(function() { 
				
		// 		createjs.Tween
		// 			.get(mesh.scale, {override:true})
		// 			.to({y: originalScaleY, z: originalScaleZ}, 50, createjs.Ease.cubicOut)
		// 			.call(function() { 
		// 				animating = false;
		// 			});

		// 	});
	}
}