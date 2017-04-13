function Trees(scene, player, collisionManager) {

	const minRadius = 80;
	const maxRadius = 160;
	const maxDistance = 180;

	const height = 20;

	var cube = new THREE.LineSegments(
        new THREE.EdgesGeometry( new THREE.BoxGeometry(4, height, 4) ),
        new THREE.LineBasicMaterial()
    );
	scene.add(cube);

	const cubes = [cube];

	for(let i=1; i<20; i++) {
		cubes.push(cube.clone());
		cubes[i].animationInProgress = false;
		scene.add(cubes[i]);
	}

	function moveTree(cube) {
		const angle = getRandom(0, Math.PI*2);
		const radius = getRandom(minRadius, maxRadius);		

		cube.animationInProgress = true;

		createjs.Tween
			.get(cube.position, {override:true})
			.to({y: -10}, 600, createjs.Ease.cubicInOut)
			.call(function() { 
				
				const x = player.position.x + radius * Math.cos(angle);
				const z = player.position.z + radius * Math.sin(angle);
				let y = collisionManager.getY(x, z) + height/2;

				if(y === null)
					y = 0;

				cube.position.x = x;
				cube.position.z = z;
				cube.position.y = y;

				cube.animationInProgress = false;
			});
	}
	
	this.update = function(time) {
		
		for(let i=0; i<cubes.length; i++) {
			
			const cube = cubes[i];

			if(!cube.animationInProgress) {
				const distance = Math.sqrt(Math.pow(player.position.x - cube.position.x, 2) + Math.pow(player.position.z - cube.position.z, 2));
				if(distance >= maxDistance)
					moveTree(cube);
			}
		}
	}
}