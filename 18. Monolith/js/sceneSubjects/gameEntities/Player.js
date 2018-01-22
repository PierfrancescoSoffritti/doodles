function Player(scene, shooter) {
    var geometry = new THREE.BoxBufferGeometry( .5, .5, .5 );
	var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
	var cube = new THREE.Mesh( geometry, material );
    scene.add( cube );
    cube.castShadow = true;
    
    this.mesh = cube;
    this.position = cube.position;
    this.rotation = cube.rotation;
    
    this.update = function(time) {
        shooter.update(time)
    }

    this.shoot = function() {
        shooter.shoot(this.position)
    }
}