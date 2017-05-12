function Snow(scene, terrainSize) {

	const snowGeometry = new THREE.Geometry();
	const range = terrainSize/1.8;
    for (let i = 0; i < 1500*5; i++) {
        
        const particle = new THREE.Vector3();
        
        particle.baseCoords = new THREE.Vector3(
        	Math.random() * range - range/2,
        	getRandom(0.4, 1.0) * range/4,
        	Math.random() * range - range/2);
        
        particle.x = particle.baseCoords.x;
        particle.y = particle.baseCoords.y;
        particle.z = particle.baseCoords.z;

        particle.velocityY = 0.1 + Math.random() / 5;
        particle.velocityX = (Math.random() - 0.5) / 3;

        snowGeometry.vertices.push(particle);
    }

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
	const texture = textureLoader.load("textures/particle.png");

	const snowMaterial = new THREE.PointsMaterial({ map: texture, color: "#fff", size: 4, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, alphaTest: 0.25 });
	const snow = new THREE.Points(snowGeometry, snowMaterial);

	const snowStartY = 400;
	const snowEndY = -range/4;
	snow.position.y = snowStartY;

	const snowInterval = getRandom(10, 12)
	let startSnowTime = snowInterval;
	const snowDuration = getRandom(150, 200);
	let isSnowing = false;
	
	this.update = function(time) {
		if(time >= startSnowTime && !isSnowing) {
			scene.add(snow);
			snow.position.y = snowStartY;
			isSnowing = true;
		}

		if(time-startSnowTime >= snowDuration) {
			startSnowTime = Number.MAX_VALUE;
			isSnowing = false;
		}

		if(isSnowing && snow.position.y > 0) {
			snow.position.y -= .2;
		} else if(!isSnowing && snow.position.y > snowEndY && snow.position.y != snowStartY) {
			snow.position.y -= .2;
		} else if(snow.position.y <= snowEndY) {
			scene.remove(snow);
			startSnowTime = time + snowInterval;
			snow.position.y = snowStartY;
		}


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