function Sprouts(scene, player, collisionManager) {

	const maxHeight = getRandom(20, 30);
	let baseY = -1;

	const group = new THREE.Group();

	const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 2), new THREE.MeshBasicMaterial({color: "#00ff00"}));	

	const leafGeometry = buildLeafGeometry()
	const leafVertices = [leafGeometry.vertices[3], leafGeometry.vertices[7], leafGeometry.vertices[11], leafGeometry.vertices[15]];

	var leafMesh = new THREE.Mesh(leafGeometry, new THREE.MeshStandardMaterial( {color: "#00ff00", wireframe: false, side: THREE.DoubleSide} ) );
	leafMesh.scale.set(20, 5, 20)

	group.add(ball);
	group.add(leafMesh);
	group.position.z = -100;
	scene.add(group);

	const light = new THREE.PointLight("#fff", 1);
	scene.add(light);
	light.position.set(0, 50, -100)

	this.update = function(time) {	
		if(baseY < 0) {
			const y = collisionManager.getY(group.position.x, group.position.z);
			if(y !== null)
				baseY = y;
		}

		ball.position.y = baseY + ((Math.sin(time)+8) / 9) * maxHeight;

		const scale = (Math.sin(time)+8)/9;
		ball.scale.set(scale, scale, scale);

		for(let i=0; i<leafVertices.length; i++)
			leafVertices[i].y = baseY + (Math.sin(time)+1)/1.2;
		leafGeometry.verticesNeedUpdate = true;
	}

	function buildLeafGeometry() {
		var geom = new THREE.Geometry();
		var v1 = new THREE.Vector3(0, -.1, -.125);
		var v2 = new THREE.Vector3(.25, .5, -.5);
		var v3 = new THREE.Vector3(-.25, .5, -.5);
		var v4 = new THREE.Vector3(0, -.1, -.8);

		var v11 = new THREE.Vector3(.125, -.1, 0);
		var v21 = new THREE.Vector3(.5, .5, -.25);
		var v31 = new THREE.Vector3(.5, .5, .25);
		var v41 = new THREE.Vector3(.8, -.1, 0);

		var v12 = new THREE.Vector3(0, -.1, .125);
		var v22 = new THREE.Vector3(.25, .5, .5);
		var v32 = new THREE.Vector3(-.25, .5, .5);
		var v42 = new THREE.Vector3(0, -.1, .8);

		var v13 = new THREE.Vector3(-.125, -.1, 0);
		var v23 = new THREE.Vector3(-.5, .5, -.25);
		var v33 = new THREE.Vector3(-.5, .5, .25);
		var v43 = new THREE.Vector3(-.8, -.1, 0);

		geom.vertices.push(v1);
		geom.vertices.push(v2);
		geom.vertices.push(v3);
		geom.vertices.push(v4);

		geom.vertices.push(v11);
		geom.vertices.push(v21);
		geom.vertices.push(v31);
		geom.vertices.push(v41);

		geom.vertices.push(v12);
		geom.vertices.push(v22);
		geom.vertices.push(v32);
		geom.vertices.push(v42);

		geom.vertices.push(v13);
		geom.vertices.push(v23);
		geom.vertices.push(v33);
		geom.vertices.push(v43);

		geom.faces.push( new THREE.Face3( 0, 1, 2 ) );
		geom.faces.push( new THREE.Face3( 3, 2, 1 ) );

		geom.faces.push( new THREE.Face3( 4, 5, 6 ) );
		geom.faces.push( new THREE.Face3( 7, 6, 5 ) );

		geom.faces.push( new THREE.Face3( 8, 9, 10 ) );
		geom.faces.push( new THREE.Face3( 11, 10, 9 ) );

		geom.faces.push( new THREE.Face3( 12, 13, 14 ) );
		geom.faces.push( new THREE.Face3( 15, 14, 13 ) );

		geom.computeFaceNormals();

		return geom;
	}
}