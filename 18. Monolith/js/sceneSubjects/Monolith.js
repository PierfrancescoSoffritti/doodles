function Monolith(scene, gameConstants) {

	const ringsOnMonolith = new THREE.Group()

	buildMonolith(scene, gameConstants)
	const bigRingMesh = buildBigRing(scene, gameConstants)
	buildRingsOnMonolith(scene, gameConstants, ringsOnMonolith)

	setInterval( moveRings, getRandom(10000, 30000) )

	this.update = function(time) {
		bigRingMesh.rotation.y += 0.001
	}

	function buildMonolith(scene, gameConstants) {
		const monolithGeometry = new THREE.CylinderBufferGeometry( 15, gameConstants.monolithRadius, 200, 32 )
		const monolithMaterial = new THREE.MeshBasicMaterial( {color: "#FFF"} )
		const monolithMesh = new THREE.Mesh( monolithGeometry, monolithMaterial )
		scene.add( monolithMesh )
	}

	function buildBigRing(scene, gameConstants) {
		const ringGeometry = new THREE.TorusBufferGeometry(gameConstants.maxRadius+10, 10, 32, 128)
		const ringMaterial = new THREE.MeshBasicMaterial({ color: "#000" })
		const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial)
		scene.add(ringMesh)

		return ringMesh
	}

	function buildRingsOnMonolith(scene, gameConstants, ringsOnMonolith) {
		ringsOnMonolith.position.y = -1

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

		ringsOnMonolith.add(ring0)
		ringsOnMonolith.add(ring1)
		ringsOnMonolith.add(ring2)

		scene.add(ringsOnMonolith)
	}

	function moveRings() {
		const tween = new TWEEN.Tween(ringsOnMonolith.position)
			.to({ y: 400 }, 1000)
			.easing(TWEEN.Easing.Cubic.InOut)
			.onComplete( () => ringsOnMonolith.position.y = -1)
			.start()
	}
}