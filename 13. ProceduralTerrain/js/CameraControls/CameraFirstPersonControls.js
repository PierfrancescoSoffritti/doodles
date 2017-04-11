function CameraFirstPersonControls(camera) {

	let direction;

	const keyState = new KeyState();

	document.onkeydown = event => {
		var forwardDirection = camera.getWorldDirection();

		switch(event.code) {
			case "KeyW":
				keyState["KeyW"] = true;
				direction = forwardDirection;
				break;
			case "KeyS":
				keyState["KeyS"] = true;
				direction = forwardDirection.multiplyScalar(-1);
				break;
			case "KeyA":
				keyState["KeyA"] = true;
				direction = forwardDirection.cross(new THREE.Vector3(0, -1, 0));
				break;
			case "KeyD":
				keyState["KeyD"] = true;
				direction = forwardDirection.cross(new THREE.Vector3(0, 1, 0));
				break;
			default:
				direction = new THREE.Vector3(0, 0, 0);
		}
    }

    document.onkeyup = event => {
    	
    	switch(event.code) {
			case "KeyW":
				keyState["KeyW"] = false;
				break;
			case "KeyS":
				keyState["KeyS"] = false;
				break;
			case "KeyA":
				keyState["KeyA"] = false;
				break;
			case "KeyD":
				keyState["KeyD"] = false;
				break;
		}
    }
	
	this.update = function(time) {
		if(keyState.isAKeyDown()) {
			const tDirection = new THREE.Vector3(direction.x, direction.y, direction.z);
			camera.position.add(tDirection.multiplyScalar(10));
		}
	}
}

function KeyState() {
	this.KeyW = false;
	this.KeyS = false;
	this.KeyA = false;
	this.KeyD = false;

	this.isAKeyDown = function() {
		return this.KeyW || this.KeyS || this.KeyA || this.KeyD;
	}
}