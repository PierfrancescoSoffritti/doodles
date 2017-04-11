function ElusiveEntity(scene, player, collisionManager) {
	const material = new THREE.MeshStandardMaterial();
	const geometry = new THREE.IcosahedronGeometry(1, 2);
	const mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	mesh.animationInProgress = false;

	collisionManager.objects.push(mesh);

	const maxRadius = 200;
	const minRadius = 160;
	const minDistance = 10;

	moveEntity(mesh);

	function moveEntity(mesh) {
		var dirVector = new THREE.Vector3();
		player.getWorldDirection(dirVector);

		var axis = new THREE.Vector3( 0, 1, 0 );
		const angle = getRandom(-Math.PI/6, Math.PI/6);
		dirVector.applyAxisAngle( axis, angle );

		const radius = getRandom(minRadius, maxRadius);		

		const targetX = player.position.x + radius * dirVector.x;
		const targetZ = player.position.z + radius * dirVector.z;
		
		mesh.animationInProgress = true;

		createjs.Tween
			.get(mesh.position, {override:true})
			.to({x: targetX, z: targetZ}, 600, createjs.Ease.cubicInOut)
			.call(function() { mesh.animationInProgress = false });
	}

	this.update = function(time) {

		if(!mesh.animationInProgress) {
			const distance = Math.sqrt(Math.pow(player.position.x - mesh.position.x, 2) + Math.pow(player.position.z - mesh.position.z, 2));
			if(distance <= minDistance)
				moveEntity(mesh);
		}

		const sinTime = Math.sin(time);

		mesh.material.emissive.r = Math.max(0, sinTime);
		mesh.material.emissive.r = .2;
		mesh.material.emissive.b = .2;
		// mesh.material.emissive.setHSL(Math.sin(time * 0.1), 0.5, 0.5);
		
		const scale = sinTime+2;
		mesh.scale.set(scale,scale,scale);
	}
}