function Monolith(scene, gameConstants) {

    var geometry = new THREE.CylinderBufferGeometry( 15, gameConstants.monolithRadius, 200, 32 );
	var material = new THREE.MeshBasicMaterial( {color: "#FFF"} );
	var cylinder = new THREE.Mesh( geometry, material );
	scene.add( cylinder );

	var geometry = new THREE.TorusGeometry(210, 4, 32, 128);
	var material = new THREE.MeshBasicMaterial({ color: "#000" });
	var ringBg = new THREE.Mesh(geometry, material);
	scene.add(ringBg)

	const rings = new THREE.Group()
	rings.position.y = -1

	const ringGeometry = new THREE.TorusGeometry(gameConstants.monolithRadius, .6, 32, 128)
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
			.to({ y: 180 }, 1000)
			.easing(TWEEN.Easing.Cubic.InOut)
			.onComplete( () => rings.position.y = -1)
			.start();
	}

    this.update = function(time) {
		ringBg.rotation.y += 0.001
	}	
}