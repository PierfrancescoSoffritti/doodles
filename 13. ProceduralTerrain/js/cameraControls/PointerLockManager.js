function PointerLockManager(camera, scene, collisionManager) {
	let controls;

	var blocker = document.getElementById( 'blocker' );
	var instructions = document.getElementById( 'instructions' );

	var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

	if ( havePointerLock ) {
		var element = document.body;
		
		var pointerlockchange = function ( event ) {
			if ( document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element ) {
				controls.enabled = true;
				blocker.style.display = 'none';
			} else {
				controls.enabled = false;
				blocker.style.display = '-webkit-box';
				blocker.style.display = '-moz-box';
				blocker.style.display = 'box';
				instructions.style.display = '';
			}
		};
		var pointerlockerror = function ( event ) {
			instructions.style.display = '';
		};

		// Hook pointer lock state change events
		document.addEventListener( 'pointerlockchange', pointerlockchange, false );
		document.addEventListener( 'mozpointerlockchange', pointerlockchange, false );
		document.addEventListener( 'webkitpointerlockchange', pointerlockchange, false );
		document.addEventListener( 'pointerlockerror', pointerlockerror, false );
		document.addEventListener( 'mozpointerlockerror', pointerlockerror, false );
		document.addEventListener( 'webkitpointerlockerror', pointerlockerror, false );
		instructions.addEventListener( 'click', function ( event ) {
			instructions.style.display = 'none';
			// Ask the browser to lock the pointer
			element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
			element.requestPointerLock();
		}, false );
	} else {
		instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';
	}

	init(camera);

	var moveForward = false;
	var moveBackward = false;
	var moveLeft = false;
	var moveRight = false;
	// var canJump = false;

	var velocity = new THREE.Vector3();

	function init(camera) {
		controls = new THREE.PointerLockControls( camera );
		scene.add( controls.getObject() );

		collisionManager.objects.push(controls.getObject());

		var onKeyDown = function ( event ) {
			switch ( event.keyCode ) {
				case 38: // up
				case 87: // w
					moveForward = true;
					break;
				case 37: // left
				case 65: // a
					moveLeft = true; break;
				case 40: // down
				case 83: // s
					moveBackward = true;
					break;
				case 39: // right
				case 68: // d
					moveRight = true;
					break;
				case 32: // space
					// if ( canJump === true ) velocity.y += 350;
					// canJump = false;
					break;
			}
		};
		var onKeyUp = function ( event ) {
			switch( event.keyCode ) {
				case 38: // up
				case 87: // w
					moveForward = false;
					break;
				case 37: // left
				case 65: // a
					moveLeft = false;
					break;
				case 40: // down
				case 83: // s
					moveBackward = false;
					break;
				case 39: // right
				case 68: // d
					moveRight = false;
					break;
			}
		};

		document.addEventListener( 'keydown', onKeyDown, false );
		document.addEventListener( 'keyup', onKeyUp, false );
	}

	const speed = 150;
	const deltaTime = 0.06;

	this.update = function() {
		if ( controls.enabled ) {

			velocity.x -= velocity.x * 10.0 * deltaTime;
			velocity.z -= velocity.z * 10.0 * deltaTime;
			// velocity.y -= 9.8 * 100.0 * deltaTime; // 100.0 = mass

			if ( moveForward ) velocity.z -= speed * deltaTime;
			if ( moveBackward ) velocity.z += speed * deltaTime;
			if ( moveLeft ) velocity.x -= speed * deltaTime;
			if ( moveRight ) velocity.x += speed * deltaTime;

			controls.getObject().translateX( velocity.x * deltaTime );
			// controls.getObject().translateY( velocity.y * deltaTime );
			controls.getObject().translateZ( velocity.z * deltaTime );
		}
	}

	this.getObject = function() {
		return controls.getObject();
	}
}