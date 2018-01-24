function Monolith(scene, laserShooter) {

    var geometry = new THREE.CylinderBufferGeometry( 15, 25, 200, 32 );
	var material = new THREE.MeshBasicMaterial( {color: "#FFF"} );
	var cylinder = new THREE.Mesh( geometry, material );
	scene.add( cylinder );
	cylinder.castShadow = true;

    this.update = function(time) {
		laserShooter.update(time, cylinder.position, 25)
	}
}