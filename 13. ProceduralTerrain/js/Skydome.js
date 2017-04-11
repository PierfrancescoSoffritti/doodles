function Skydome(scene, terrainSize) {
	var starsGeometry = new THREE.IcosahedronGeometry(terrainSize/2, 4);
	
    // geometry deformation
    for (var i=0; i<starsGeometry.vertices.length; i+=1) {
    	var scalar = 1+ Math.random() + Math.random();
    	starsGeometry.vertices[i].multiplyScalar(scalar)
	}

	// stars
	const texture = new THREE.TextureLoader().load("textures/particle.png");
	const starMaterial = new THREE.PointsMaterial({ map: texture, color: "#fff", size: 10, blending: THREE.AdditiveBlending, transparent: false, opacity: 0.5, alphaTest: 0.25 });
	const stars = new THREE.Points(starsGeometry, starMaterial);
	scene.add(stars);

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

	// snow
	const snowMaterial = new THREE.PointsMaterial({ map: texture, color: "#fff", size: 4, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, alphaTest: 0.25 });
	const snow = new THREE.Points(snowGeometry, snowMaterial);

	let startSnowTime = getRandom(50, 80);
	const snowDuration = getRandom(100, 200);
	let isSnowing = false;

	// moon
	const moonGeometry = new THREE.IcosahedronGeometry(1000, 3);
	const moonMaterial = new THREE.MeshBasicMaterial({color: "#fff"});
	const moon = new THREE.Mesh(moonGeometry, moonMaterial);
	scene.add(moon);
	moon.position.z = -terrainSize/1.8;

	this.update = function(time, player) {
		// moon
		moon.position.x = terrainSize * Math.sin(time*0.01 - Math.PI/2);
		moon.position.y = terrainSize/2 * Math.cos(time*0.01 - Math.PI/2);
		// moon.position.z = 50 * Math.cos(time);

		// stars
		stars.rotation.y -= .0001;
		stars.rotation.x -= .0001;

		// snow
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