function Octahedrons(scene, collisionManager, terrainSize, cubeCamera) {

	const octahedrons = [];

	const material = new THREE.MeshBasicMaterial();
	material.envMap = cubeCamera.renderTarget.texture;

	for(let i=0; i<4; i++) {
		const x = getRandom(-terrainSize/8, terrainSize/12);
		const z = getRandom(-terrainSize/8, terrainSize/18);

		const size = getRandom(5, 15);

		var main = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), material);
		main.size = size;
		main.position.set(x, -1, z);	

		const small1 = main.clone();
		const scale = getRandom(0.2, 0.3);		
		small1.scale.set(scale, scale, scale)

		const small2 = small1.clone();

		const group = new THREE.Group();
		group.add(main);
		group.add(small1);
		group.add(small2);

		scene.add(group);

		octahedrons.push(group)
	}

	const speed1 = 1;
	const speed2 = .5;

	let isActionAvailable = false;

	this.checkCollision = function(raycaster, mouseDown) {
		isActionAvailable = false;

		for(let i=0; i<octahedrons.length; i++) {

			const target = octahedrons[i].children[0];

			const distance = raycaster.ray.origin.distanceTo(target.position)			
			if(distance > target.size*6)
				continue;

			const collisionResults = raycaster.intersectObject(target);

	        if (collisionResults.length > 0) {
	        	if(mouseDown) {
	        		eventBus.post(playLowNote);

	        		rotate(target);
	        		rotate(octahedrons[i].children[1]);
	        		rotate(octahedrons[i].children[2]);
	        	}
	            isActionAvailable = true;
	            break;
	        }
		}

		return isActionAvailable;
	}

	function rotate(mesh) {
		const tween = new TWEEN.Tween(mesh.rotation)
			.to({y: mesh.rotation.y+Math.PI/2, z: mesh.rotation.z+Math.PI/2}, 600)
			.easing(TWEEN.Easing.Cubic.InOut)
			.start();
	}

	this.update = function(time) {
		
		material.color.setHSL(Math.sin(time*0.1), 0.5, 0.5);

		const scale = (Math.sin(time*0.6)+6)/7;
		
		const ang1 = time/2;
		const ang2 = time/4;

		for(let i=0; i<octahedrons.length; i++) {
			
			const octahedron = octahedrons[i].children[0];

			// update y
			if(octahedron.position.y < 0) {
				const y = collisionManager.getY(octahedron.position.x, octahedron.position.z);
				if(y !== null)
					octahedron.position.y = y + octahedron.size*2;
			}

			const rad = octahedron.size;

			const small1 = octahedrons[i].children[1];
			const small2 = octahedrons[i].children[2];

			small1.position.x = octahedron.position.x + rad * Math.sin(ang1*speed1) * Math.cos(ang2*speed1)
			small1.position.y = octahedron.position.y + rad * Math.sin(ang1*speed1) * Math.sin(ang2*speed1)
			small1.position.z = octahedron.position.z + rad * Math.cos(ang1*speed1)

			small2.position.x = octahedron.position.x + rad * Math.sin(-ang1*speed2) * Math.cos(-ang2*speed2)
			small2.position.y = octahedron.position.y + rad * Math.sin(-ang1*speed2) * Math.sin(-ang2*speed2)
			small2.position.z = octahedron.position.z + rad * Math.cos(-ang1*speed2)

			octahedron.scale.set(scale, scale, scale);
		}
	}
}