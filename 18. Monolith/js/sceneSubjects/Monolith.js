function Monolith(scene, gameConstants) {

    const monolithGeometry = new THREE.CylinderBufferGeometry( 15, gameConstants.monolithRadius, 200, 32 );
	const monolithMaterial = new THREE.MeshBasicMaterial( {color: "#FFF"} );
	const monolith = new THREE.Mesh( monolithGeometry, monolithMaterial );
	scene.add( monolith );

	const geometry = new THREE.TorusBufferGeometry(gameConstants.maxRadius+10, 10, 32, 128);
	const material = new THREE.MeshBasicMaterial({ color: "#000" });
	const ringBG = new THREE.Mesh(geometry, material);
	scene.add(ringBG)

	const rings = new THREE.Group()
	rings.position.y = -1

	const ringGeometry = new THREE.TorusBufferGeometry(gameConstants.monolithRadius, .6, 32, 128)
	const ringMaterial = new THREE.MeshBasicMaterial({ color: "#000"  })
	const ring0 = new THREE.Mesh(ringGeometry, ringMaterial)
	ring0.rotation.x = Math.PI/2

	const ring1 = ring0.clone()
	ring1.position.y -= 16
	ring1.rotation.x = Math.PI/2

	const ring2 = ring1.clone()
	ring2.position.y -= 20
	ring2.rotation.x = Math.PI/2

	rings.add(ring0)
	rings.add(ring1)
	rings.add(ring2)

	scene.add(rings)

	setInterval( moveRings, getRandom(10000, 30000) )

	function moveRings() {
		const tween = new TWEEN.Tween(rings.position)
			.to({ y: 400 }, 1000)
			.easing(TWEEN.Easing.Cubic.InOut)
			.onComplete( () => rings.position.y = -1)
			.start();
	}

    this.update = function(time) {
		ringBG.rotation.y += 0.001
	}	
}