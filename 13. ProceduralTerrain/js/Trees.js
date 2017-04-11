function Trees(scene, player, collisionManager) {

	var cubeGeometry = new THREE.BoxGeometry(4, 10, 4);
	var cubeMaterial = new THREE.MeshBasicMaterial( {color: "#00000a", wireframe: false} );
	var cube = new THREE.Mesh( cubeGeometry, cubeMaterial );
	scene.add(cube);

	var cubeWireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(cube.geometry),
        new THREE.LineBasicMaterial()
    );
    cube.add(cubeWireframe)

	cubes = [cube];

	for(let i=1; i<20; i++) {
		cubes.push(cube.clone());
		cubes[i].animationInProgress = false;
		scene.add(cubes[i]);
	}

	const minRadius = 80;
	const maxRadius = 160;
	const maxDistance = 180;

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
				const y = collisionManager.getY(x, z);

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

			const position = Math.sin(time)/10;
			cube.geometry.vertices[0].y -= position
			cube.geometry.vertices[1].y -= position
			cube.geometry.vertices[4].y -= position
			cube.geometry.vertices[5].y -= position
			cube.geometry.verticesNeedUpdate = true; 
		}
	}
}