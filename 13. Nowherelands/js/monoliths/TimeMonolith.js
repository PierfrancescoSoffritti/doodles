const toggleTime = "toggleTime";

function TimeMonolith(scene, collisionManager, terrainSize, cubeCamera) {

	const group = new THREE.Group();
	group.position.set(-500, 0, -500);
	// group.position.set(0, 0, -100);
	group.scale.set(5, 5, 5);

	const cylinder = new THREE.Mesh(new THREE.CylinderBufferGeometry(1, 1, 1, 6), new THREE.MeshToonMaterial( {color: "#424242", shading: THREE.FlatShading} ) );
	cylinder.scale.set(10, 1, 10);
	cylinder.position.y = -.3;
	group.add(cylinder);

	cylinderSmall = cylinder.clone();
	cylinderSmall.scale.set(cylinder.scale.x * .5, cylinder.scale.y * .5, cylinder.scale.z * .5);
	cylinderSmall.position.y += .4;
	group.add(cylinderSmall);

	cylinderHigh = cylinder.clone();
	cylinderHigh.scale.set(1.5, 2, 1.5);
	cylinderHigh.position.y += .8;
	group.add(cylinderHigh);

	const sphere = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 32, 32), new THREE.MeshBasicMaterial());
	sphere.material.envMap = cubeCamera.renderTarget.texture;
	sphere.position.y = 6
	group.add(sphere);

	const light = new THREE.PointLight("#fff", .5, 100, 2);
	light.position.y = 6;
	group.add(light);

	scene.add(group);
	
	this.update = function(time) {
		sphere.position.y = 4* (Math.sin(time)+5)/6;
		// update Y
		// if(light.position.y < 0) {
		// 	const y = collisionManager.getY(light.position.x, light.position.z);
		// 	console.log(y)
		// 	if(y !== null) {
		// 		light.position.y = y+40;
		// 		octahedron.position.y = y+30;
		// 	}
		// }
	}

	let isActionAvailable = false;

	this.checkCollision = function(raycaster, mouseDown) {
		isActionAvailable = false;

		const distance = raycaster.ray.origin.distanceTo(group.position)			
		if(distance > 50)
			return;

		const collisionResults = raycaster.intersectObject(sphere);

        if (collisionResults.length > 0) {
        	
        	if(mouseDown)
            	eventBus.post(toggleTime)

            isActionAvailable = true;
        }

		return isActionAvailable;
	}
}