function Skydome(scene) {
	var starsGeometry = new THREE.IcosahedronGeometry(440*9, 4);
	
    // geometry deformation
    for (var i=0; i<starsGeometry.vertices.length; i+=1) {
    	var scalar = 1+ Math.random() + Math.random();
    	starsGeometry.vertices[i].multiplyScalar(scalar)
	}

	// particles
	var texture = new THREE.TextureLoader().load("textures/particle.png");
	var starMaterial = new THREE.PointsMaterial({ map: texture, color: "#fff", size: 10, blending: THREE.AdditiveBlending, transparent: false, opacity: 0.5, alphaTest: 0.25 });
	var stars = new THREE.Points(starsGeometry, starMaterial);
	scene.add(stars);

	// var snowGeometry = new THREE.IcosahedronGeometry(200, 2);	
    // geometry deformation
 //    for (var i=0; i<snowGeometry.vertices.length; i+=1) {
 //    	var scalar = Math.random() + Math.random();
 //    	snowGeometry.vertices[i].multiplyScalar(scalar)
	// }

	var snowGeometry = new THREE.Geometry();
	var range = 440*9;
    for (var i = 0; i < 1500*10; i++) {
        var particle = new THREE.Vector3(
                Math.random() * range - range / 2,
                Math.random() * range/6 * 1.5,
                Math.random() * range - range / 2);
        particle.velocityY = 0.1 + Math.random() / 5;
        particle.velocityX = (Math.random() - 0.5) / 3;
        snowGeometry.vertices.push(particle);
    }

	// particles
	var texture = new THREE.TextureLoader().load("textures/particle.png");
	var snowMaterial = new THREE.PointsMaterial({ map: texture, color: "#fff", size: 4, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, alphaTest: 0.25 });
	var snow = new THREE.Points(snowGeometry, snowMaterial);
	scene.add(snow);

	this.update = function(time, player) {
		stars.rotation.y += .0001;
		stars.rotation.x += .0001;

		// snow.rotation.y += .001;
		// snow.position.x = player.position.x;
		// snow.position.z = player.position.z;
		for(let i=0; i<snowGeometry.vertices.length; i++) {
			const vertex = snowGeometry.vertices[i];
			// vertex.y -= 0.1;
			vertex.y -= vertex.velocityY;
            vertex.x -= vertex.velocityX;

            if(vertex.y <= 0) {
            	vertex.x = Math.random() * range - range / 2,
                vertex.y = Math.random() * range/6,
                vertex.z = Math.random() * range - range / 2;
            }
		}
		snowGeometry.verticesNeedUpdate = true;        
	}
}