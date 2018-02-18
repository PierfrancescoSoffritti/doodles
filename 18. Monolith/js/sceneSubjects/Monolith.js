function Monolith(scene, gameConstants) {

    var geometry = new THREE.CylinderBufferGeometry( 15, gameConstants.monolithRadius, 200, 32 );
	var material = new THREE.MeshBasicMaterial( {color: "#FFF"} );
	var cylinder = new THREE.Mesh( geometry, material );
	scene.add( cylinder );

    this.update = function(time) {
	}
}