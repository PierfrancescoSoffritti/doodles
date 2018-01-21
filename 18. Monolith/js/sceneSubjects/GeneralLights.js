function GeneralLights(scene) {
	
	const light = new THREE.PointLight("#fff", 1);
	light.position.y = 200
	scene.add(light);
	
	var sphereSize = 1;
	var pointLightHelper = new THREE.PointLightHelper( light, sphereSize );
	scene.add( pointLightHelper );
	
	this.update = function(time) {
		// light.intensity = (Math.sin(time)+1.5)/1.5;
		// light.color.setHSL( Math.sin(time), 0.5, 0.5 );
	}
}