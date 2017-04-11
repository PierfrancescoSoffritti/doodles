function Snow(scene, terrainSize) {

	const snowGeometry = new THREE.Geometry();
	const range = terrainSize/1.8;
    for (let i = 0; i < 1500*5; i++) {
        
        const particle = new THREE.Vector3();
        
        particle.baseCoords = new THREE.Vector3(
        	Math.random() * range - range / 2,
        	Math.random() * range/6 * 1.5,
        	Math.random() * range - range / 2);
        
        particle.x = particle.baseCoords.x;
        particle.y = particle.baseCoords.y;
        particle.z = particle.baseCoords.z;

        particle.velocityY = 0.1 + Math.random() / 5;
        particle.velocityX = (Math.random() - 0.5) / 3;

        snowGeometry.vertices.push(particle);
    }

	const texture = new THREE.TextureLoader().load("textures/particle.png");
	const snowMaterial = new THREE.PointsMaterial({ map: texture, color: "#fff", size: 4, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, alphaTest: 0.25 });
	const snow = new THREE.Points(snowGeometry, snowMaterial);

	let startSnowTime = getRandom(50, 80);
	const snowDuration = getRandom(100, 200);
	let isSnowing = false;
	
	this.update = function(time) {
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
			snow.position.y -= .2;
		else if(!isSnowing && snow.position.y > -range/2)
			snow.position.y -= .2;
		else if(snow.position.y <= -range/2)
			scene.remove(snow);


		for(let i=0; i<snowGeometry.vertices.length; i++) {
			const vertex = snowGeometry.vertices[i];
			vertex.y -= vertex.velocityY;
            vertex.x -= vertex.velocityX;

            if(vertex.y <= 0) {
            	vertex.x = vertex.baseCoords.x;
		        vertex.y = vertex.baseCoords.y;
		        vertex.z = vertex.baseCoords.z;
            }
		}
		snowGeometry.verticesNeedUpdate = true;
	}
}