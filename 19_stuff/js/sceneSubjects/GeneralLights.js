function GeneralLights(scene) {
	
	const light = new THREE.PointLight("#DA9B9B", 0.5);
	light.position.set(0, 4, -4)
    scene.add(light);
	
	this.update = function(time) {
		light.intensity = 0.5 + (Math.sin(time) +1) / 5
		// light.position.z = -4 + ( (Math.sin(time)+1) / 2 ) *-10
		// light.intensity = (Math.sin(time)+1.5)/1.5;
		// light.color.setHSL( Math.sin(time), 0.5, 0.5 );
	}
}