function Player(scene, shooter) {
    const group = new THREE.Group()
    scene.add( group )

    const geometry = new THREE.BoxBufferGeometry( .5, .5, .8 )
	const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} )
	const cube = new THREE.Mesh( geometry, material )
    cube.castShadow = true
    group.add(cube)
    
    this.mesh = cube
    this.position = group.position
    this.rotation = group.rotation
    
    this.update = function(time) {
        shooter.update(time)
    }

    this.shoot = function() {
        const position = group.position.clone()
        position.y -= 1
        shooter.shoot(position)
    }
}