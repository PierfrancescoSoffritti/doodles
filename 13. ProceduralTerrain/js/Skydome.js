function Skydome(scene, terrainSize) {
	var starsGeometry = new THREE.IcosahedronGeometry(terrainSize/2, 4);
	
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

	var snowGeometry = new THREE.Geometry();
	var range = terrainSize/1.8;
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
	// scene.add(snow);

	let startSnowTime = getRandom(50, 150);
	let snowDuration = getRandom(100, 200);
	let isSnowing = false;

	this.update = function(time, player) {
		stars.rotation.y += .0001;
		stars.rotation.x += .0001;

		if(time >= startSnowTime && !isSnowing) {
			scene.add(snow);
			snow.position.y = 400;
			isSnowing = true;
		}

		if(time-startSnowTime >= snowDuration) {
			startSnowTime+=time
			isSnowing = false;
		}

		if(isSnowing && snow.position.y > 0)
			snow.position.y -= .1;
		else if(!isSnowing && snow.position.y > -range/2)
			snow.position.y -= .1;
		else if(snow.position.y <= -range/2)
			scene.remove(snow);


		for(let i=0; i<snowGeometry.vertices.length; i++) {
			const vertex = snowGeometry.vertices[i];
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