function Grass(scene, player, collisionManager) {

	const minRadius = 40;
	const maxRadius = 160;
	const maxDistance = 180;

	const height = 4;

	const material = new THREE.LineBasicMaterial();

	const cube = new THREE.LineSegments(
        new THREE.EdgesGeometry( new THREE.CylinderGeometry(.2, .4, height, 2) ),
        material
    );
    const cubeSmall = new THREE.LineSegments(
        new THREE.EdgesGeometry( new THREE.CylinderGeometry(.2, .4, height/2, 2) ),
        material
    );

	const cubes = [];

	for(let i=0; i<20; i++) {
		const grassBig = cube.clone();
		const grassSmall = cubeSmall.clone();
		const grassSmall2 = cubeSmall.clone();

		grassSmall.position.x -= getRandom(0, 3);
	    grassSmall.position.y -= height/4
	    grassSmall.position.z -= getRandom(-3, 3);

	    grassSmall2.position.x -= getRandom(-4, 0);
	    grassSmall2.position.y -= height/4
	    grassSmall2.position.z -= getRandom(-4, 4);

	    const group = new THREE.Group()
	    group.add(grassBig)
	    group.add(grassSmall)
	    group.add(grassSmall2)
	    group.rotation.y = getRandom(0, Math.PI*2);

		cubes.push(group);
		cubes[i].animationInProgress = false;
		scene.add(cubes[i]);
	}

	function moveTree(cube) {
		const angle = getRandom(0, Math.PI*2);
		const radius = getRandom(minRadius, maxRadius);	

		const x = player.position.x + radius * Math.cos(angle);
		const z = player.position.z + radius * Math.sin(angle);
		let y = collisionManager.getY(x, z) + height/2;

		if(y === null)
			y = 0;

		animateOut(cube, x, y, z, animateIn);
	}

	function animateOut(cube, x, y, z, animateIn) {
		cube.animationInProgress = true;

		createjs.Tween
			.get(cube.position, {override:true})
			.to({y: -height}, 300, createjs.Ease.cubicInOut)
			.call(function() { 

				cube.position.x = x;
				cube.position.z = z;

				if(!animateIn) { 
					cube.position.y = y;
					cube.animationInProgress = false;
				} else {
					animateIn(cube, y);
				}
			});
	}

	function animateIn(cube, y) {
		cube.animationInProgress = true;

		createjs.Tween
			.get(cube.position, {override:true})
			.to({y: y}, 300, createjs.Ease.cubicInOut)
			.call(function() {
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