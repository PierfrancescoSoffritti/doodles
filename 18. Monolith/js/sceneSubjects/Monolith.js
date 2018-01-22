function Monolith(scene) {

    var geometry = new THREE.CylinderBufferGeometry( 5, 35, 150, 32 );
	var material = new THREE.MeshBasicMaterial( {color: "#FFF"} );
	var cylinder = new THREE.Mesh( geometry, material );
	scene.add( cylinder );
	cylinder.castShadow = true;

	var geometry = new THREE.BoxBufferGeometry( 40, 25, 40 );
	var material = new THREE.MeshBasicMaterial( {color: "#FFF"} );
	var cube = new THREE.Mesh( geometry, material );
	scene.add( cube );
	cube.castShadow = true;

    this.update = function(time) {
	}
}