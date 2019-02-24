function ElusiveEntity(scene, player, collisionManager) {
	const radius = 2;
	const mesh = new THREE.Mesh(new THREE.OctahedronBufferGeometry(radius, 0), new THREE.MeshToonMaterial());
	mesh.position.set(0, 1, -200);
	scene.add(mesh);

	mesh.animationInProgress = false;
	collisionManager.objects.push(mesh);

	const light = new THREE.PointLight("#fff", 2, 50, 2);
	mesh.add(light);

	const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
	const texture = textureLoader.load("textures/particle.png");

	const particleMaterial = new THREE.PointsMaterial({ map: texture, color: "#fff", size: 1,
		blending: THREE.AdditiveBlending, transparent: true, opacity:1, alphaTest: 0.25 });
	
	const particlesGeometry = new THREE.Geometry();
	for(let i=0; i<20; i++) {
		const particle = new THREE.Vector3(0, -1, 0);

		particle.velocityX = (Math.random() - 0.5) / 30;
		particle.velocityY = (Math.random() - 0.5) / 30;
		particle.velocityZ = (Math.random() - 0.5) / 30;

		particle.life = 0;
		particle.lifeSpan = getRandomInt(50, 200);

		particlesGeometry.vertices.push(particle);
	}

	const particles = new THREE.Points(particlesGeometry, particleMaterial);
	particles.frustumCulled = false
	scene.add(particles);

	const maxRadius = 220;
	const minRadius = 180;
	const minDistance = 40;

	const up = new THREE.Vector3( 0, 1, 0 );
	const dirVector = new THREE.Vector3();

	// moveEntity(mesh);

	function moveEntity(mesh) {
		player.controls.getDirection(dirVector);

		const angle = getRandom(-Math.PI/2.5, Math.PI/2.5);
		dirVector.applyAxisAngle( up, angle );

		const radius = getRandom(minRadius, maxRadius);		

		const targetX = player.position.x + radius * dirVector.x;
		const targetZ = player.position.z + radius * dirVector.z;
		
		mesh.animationInProgress = true;

		var tween = new TWEEN.Tween(mesh.position)
			.to({ x: targetX, z: targetZ }, 600)
			.easing(TWEEN.Easing.Cubic.InOut)
			.onComplete(function () {
				mesh.animationInProgress = false
			})
			.start();
	}

	function rotate(mesh) {
		const tween = new TWEEN.Tween(mesh.rotation)
			.to({y: mesh.rotation.y+Math.PI*2, z: mesh.rotation.z+Math.PI*2}, 1000)
			.easing(TWEEN.Easing.Cubic.InOut)
			.start();
	}

	this.update = function(time) {

		if(!mesh.animationInProgress) {
			// const distance = Math.sqrt(Math.pow(player.position.x - mesh.position.x, 2) + Math.pow(player.position.z - mesh.position.z, 2));
			const distance = player.position.distanceTo(mesh.position);

			if(distance <= minDistance) {
				eventBus.post(playHighNote);
				moveEntity(mesh);
				rotate(mesh);
			}
		}

		const sinTime = Math.sin(time);
		const color = Math.sin(time * 0.1);

		mesh.material.emissive.setHSL(color, 0.5, 0.6);
		particleMaterial.color.setHSL(color, 0.9, 0.2);
		light.color.setHSL(color, 0.9, 0.6)
		
		const scale = (sinTime+2)*1.2;
		mesh.scale.set(scale,scale,scale);

		if(!mesh.animationInProgress) {
			mesh.position.x += sinTime/4;
			mesh.position.z += Math.cos(time)/4;
		}

		// particles
		for(let i=0; i<particlesGeometry.vertices.length; i++) {
			const particle = particlesGeometry.vertices[i];
			particle.x -= particle.velocityX
			particle.y -= particle.velocityY
			particle.z -= particle.velocityZ

			particle.life++;

			if(particle.life > particle.lifeSpan) {
				const ang1 = getRandom(0, Math.PI*2);
				const ang2 = getRandom(0, Math.PI*2);

				particle.life = 0;
				particle.x = mesh.position.x + radius*scale*1.2 * Math.sin(ang1) * Math.cos(ang2)
				particle.y = mesh.position.y + radius*scale*1.2 * Math.sin(ang1) * Math.sin(ang2)
				particle.z = mesh.position.z + radius*scale*1.2 * Math.cos(ang1)
			}
		}	
		particlesGeometry.verticesNeedUpdate = true;
	}
}