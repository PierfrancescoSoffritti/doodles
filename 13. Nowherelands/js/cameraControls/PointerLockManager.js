function PointerLockManager(camera, scene, collisionManager) {
	let controls;

	const blocker = document.getElementById( 'blocker' );
	const instructions = document.getElementById( 'instructions' );

	const havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

	if ( havePointerLock ) {
		const element = document.body;
		
		const pointerlockchange = function ( event ) {
			if ( document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element ) {
				controls.enabled = true;
				blocker.style.display = 'none';
			} else {
				controls.enabled = false;
				// blocker.style.display = '-webkit-box';
				// blocker.style.display = '-moz-box';
				// blocker.style.display = 'box';
				// instructions.style.display = '';
				blocker.style.display = '';
			}
		};
		const pointerlockerror = function ( event ) {
			// instructions.style.display = '';
			instructions.innerHTML = 'error';
		};

		// Hook pointer lock state change events
		document.addEventListener( 'pointerlockchange', pointerlockchange, false );
		document.addEventListener( 'mozpointerlockchange', pointerlockchange, false );
		document.addEventListener( 'webkitpointerlockchange', pointerlockchange, false );
		document.addEventListener( 'pointerlockerror', pointerlockerror, false );
		document.addEventListener( 'mozpointerlockerror', pointerlockerror, false );
		document.addEventListener( 'webkitpointerlockerror', pointerlockerror, false );
		blocker.addEventListener( 'click', function ( event ) {
			
			blocker.style.display = 'none';

			// Ask the browser to lock the pointer
			element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
			element.requestPointerLock();

		}, false );
	} else {
		instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';
	}

	init(camera);

	let moveForward = false;
	let moveBackward = false;
	let moveLeft = false;
	let moveRight = false;

	const velocity = new THREE.Vector3();

	function init(camera) {
		controls = new THREE.PointerLockControls(camera);
		scene.add(controls.getObject());

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

			if ( moveForward ) velocity.z -= speed * deltaTime;
			if ( moveBackward ) velocity.z += speed * deltaTime;
			if ( moveLeft ) velocity.x -= speed * deltaTime;
			if ( moveRight ) velocity.x += speed * deltaTime;

			controls.getObject().translateX( velocity.x * deltaTime );
			controls.getObject().translateZ( velocity.z * deltaTime );
		}
	}

	this.getObject = function() {
		return controls.getObject();
	}
}