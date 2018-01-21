function Player(scene) {
    var geometry = new THREE.BoxBufferGeometry( 1, 1, 1 );
	var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
	var cube = new THREE.Mesh( geometry, material );
    scene.add( cube );
    
    this.mesh = cube;
    this.position = cube.position;
    this.rotation = cube.rotation;
    
    const shooter = new Shooter(scene)
    this.shooter = shooter

    this.update = function(time) {
        shooter.update(time)
    }

    this.shoot = function() {
        shooter.shoot(this.position)
    }
}