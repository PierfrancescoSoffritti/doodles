function Moon(scene, terrainSize) {
	
	const moonGeometry = new THREE.IcosahedronGeometry(1000, 3);
	const moonMaterial = new THREE.MeshBasicMaterial({color: "#fff"});
	const moon = new THREE.Mesh(moonGeometry, moonMaterial);
	scene.add(moon);
	moon.position.z = -terrainSize/1.8;

	this.update = function(time) {
		const angle = time*0.01 - Math.PI/2;
		
		moon.position.x = terrainSize * Math.sin(angle);
		moon.position.y = terrainSize/2 * Math.cos(angle);
	}
}