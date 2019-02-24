function Sprouts(scene, player, collisionManager, terrainSize) {
	const self = this;

	const group = new THREE.Group();

	const ball = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(4, 1), new THREE.MeshToonMaterial({color: "#ffffff"}));	

	const leafGeometry = buildLeafGeometry()
	const leafVertices = [leafGeometry.vertices[3], leafGeometry.vertices[7], leafGeometry.vertices[11], leafGeometry.vertices[15]];

	var leafMesh = new THREE.Mesh(leafGeometry, new THREE.MeshToonMaterial( {color: "#33691E", wireframe: false, side: THREE.DoubleSide} ) );
	leafMesh.scale.set(17, 3, 17)

	group.add(ball);
	group.add(leafMesh);

	const sprouts = []

	for(let i=0; i<100; i++) {
		const xOffset = getRandom(-terrainSize/6, terrainSize/16);
		const zOffset = getRandom(-terrainSize/4, terrainSize/16);

		const tGroup = group.clone();
		tGroup.position.set(xOffset, -1, zOffset);
		tGroup.maxHeight = getRandom(5, 15);
		tGroup.scaleFactor = getRandom(0.1, 1);
		tGroup.children[1].scale.multiplyScalar(tGroup.scaleFactor);
		sprouts.push(tGroup)
		scene.add(tGroup);
	}

	this.fac = 0;

	eventBus.subscribe(notePlayed, onNotePlayed)

	function onNotePlayed() {
		const tween = new TWEEN.Tween(self)
			.to({fac: .8 }, 200)
			.easing(TWEEN.Easing.Cubic.InOut)
			.onComplete(function() {
				
				const tween = new TWEEN.Tween(self)
					.to({fac: 0}, 300)
					.easing(TWEEN.Easing.Cubic.InOut)
					.start();

			})
			.start();
	}

	this.update = function(time) {	
		for(let i=0; i<leafVertices.length; i++)
			leafVertices[i].y = (Math.sin(time)+1)/1.2;
		leafGeometry.verticesNeedUpdate = true;

		const sinColor = (Math.sin(time)+2) / 3;
		const sin = (Math.sin(time)+8) / 9;

		ball.material.emissive.setHSL(sinColor, .5, .2 + self.fac);

		for(let i=0; i<sprouts.length; i++) {
			
			const group = sprouts[i];

			// update Y
			if(group.position.y < 0) {
				const y = collisionManager.getY(group.position.x, group.position.z);
				if(y !== null) {
					group.position.y = y;
				}
			}

			group.children[0].position.y =  sin * group.maxHeight;

			const scale = sin * group.scaleFactor;
			group.children[0].scale.set(scale, scale, scale);
		}
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