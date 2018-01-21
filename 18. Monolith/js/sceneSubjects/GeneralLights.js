function GeneralLights(scene) {
	
	// Spotlight
var spotLight = new THREE.SpotLight( "#fff", 1, 400, Math.PI/3, 0, 2);
spotLight.position.set( 0, 150, 0 );
spotLight.target.position.set(0,0,0);
spotLight.castShadow = true
scene.add( spotLight );
scene.add( spotLight.target );

// Frustum
var helper = new THREE.CameraHelper( spotLight.shadow.camera )
scene.add( helper )

// PointLight
var pointLight = new THREE.PointLight( "#fff", .5, 400 );
pointLight.position.set( 0, 200, 0 );
scene.add( pointLight );
	
	this.update = function(time) {
		// light.intensity = (Math.sin(time)+1.5)/1.5;
		// light.color.setHSL( Math.sin(time), 0.5, 0.5 );
	}
}