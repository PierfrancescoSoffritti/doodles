function Sproutes(scene, player, collisionManager) {
	
	// const material = new THREE.MeshBasicMaterial({color: "#00ff00"})
	// const geometry = new THREE.IcosahedronGeometry(8, 2);
	// const mesh = new THREE.Mesh(geometry, material);

	// const maxHeight = getRandom(40, 50);

	// mesh.position.set(0, 50, -100);

	// scene.add(mesh);

	var geom = new THREE.Geometry();
	var v1 = new THREE.Vector3(0, 0, 0);
	var v2 = new THREE.Vector3(-30, -10, 0);
	var v3 = new THREE.Vector3(-30, 0, 30);
	var v4 = new THREE.Vector3(0, -30, 30);

	geom.vertices.push(v1);
	geom.vertices.push(v2);
	geom.vertices.push(v3);
	geom.vertices.push(v4);

	geom.faces.push( new THREE.Face3( 0, 1, 2 ) );
	geom.faces.push( new THREE.Face3( 2, 3, 0 ) );
	geom.computeFaceNormals();

	var mesh = new THREE.Mesh( geom, new THREE.MeshStandardMaterial( {color: "#00ff00", wireframe: false} ) );
	mesh.position.set(0, 5, -100)
	mesh.scale.set(.1, .1, .1)

	const light = new THREE.PointLight("#fff", 1);
	scene.add(light);
	light.position.set(0,50, -100)


	scene.add(mesh);

	this.update = function(time) {
		// todo	
		// mesh.position.y = ((Math.sin(time)+8) / 9) * maxHeight;

		// const scale = (Math.sin(time)+8)/9;
		// mesh.scale.set(scale, scale, scale);
	}
}