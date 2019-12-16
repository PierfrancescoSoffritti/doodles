function Floor(scene) {
    
    const left = new THREE.Mesh(
		new THREE.BoxGeometry(20, 20, 10), 
		new THREE.MeshStandardMaterial({ color: "#000", metalness: 1, roughness: 0.5 })
	)

    left.position.set(-10.4, -10.8, -6);
    scene.add(left);

    const right = left.clone()
    right.position.set(10.4, -10.8, -6)
    scene.add(right)

    var geometry = new THREE.ConeGeometry( 6, 8, 3, 1 );
    var material = new THREE.MeshBasicMaterial({ color: "#000", fog: false });
    var cone = new THREE.Mesh( geometry, material );
    cone.position.set(0, 2, -13)
    cone.rotation.y = Math.PI
    scene.add(cone);

    const water = new THREE.Mesh(
		new THREE.PlaneGeometry(2, 20, 1), 
		new THREE.MeshStandardMaterial({ color: "#ff0000", metalness: 1, roughness: 0.1 })
    )
    water.rotation.x = -Math.PI/2
    water.position.set(0, -0.94, -4)
    scene.add(water)

	this.update = function(time) {
	}
}