function Floor(scene) {
	// const self = this;

	const colors = ["#444"] //, "#9C27B0", "#3F51B5", "#4CAF50"]
	
	this.group = new THREE.Group();
	scene.add(this.group);

	// var geometry = new THREE.PlaneBufferGeometry(2000, 2000, 32 );
	// var material = new THREE.MeshStandardMaterial({color: "#FF2C2C", shading: THREE.SmoothShading, metalness: .0, roughness: 1 });
	// var plane = new THREE.Mesh( geometry, material );
	// plane.rotation.x = -Math.PI/2
	// this.group.add( plane );
	// plane.receiveShadow = true;

	for(let i=0; i<400; i++)
		placePillar(this.group, 210, 300)

	function placePillar(group, radiusMin, radiusMax) {
		const radius = getRandom(radiusMin, radiusMax)
		const angle = getRandom(0, Math.PI*2)
		// const color = colors[getRandomInt(0, colors.length-1)]
		const pillarColor = getRandom(.2, .9)

		const x = radius * cos(angle)
        const y = 0
        const z = radius * sin(angle)
	
		var pillarGeometry = new THREE.BoxBufferGeometry( getRandomInt(5,30), getRandomInt(5,50), getRandomInt(5,30) );
		// var pillarMaterial = new THREE.MeshBasicMaterial( {color: color} );
		var pillarMaterial = new THREE.MeshBasicMaterial( );
		pillarMaterial.color.setRGB(pillarColor, pillarColor, pillarColor);
		var pillar = new THREE.Mesh( pillarGeometry, pillarMaterial );

		pillar.position.set(x, y, z)
		group.add(pillar)
	}


	const mapGenerator = new MapGenerator(150, 5, .5, 20, Math.random(), [0, 0], false);
    const map = mapGenerator.generateMap();

    // const scale = 15;

    // terrain
    const mesh = new TerrainMeshGenerator().generateTerrainMesh(map, .4, 8, 2).createMesh();
    // mesh.scale.set(scale, scale, scale);
    scene.add(mesh);

    // terrain wireframe
    const terrainWireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial()
	);
	const wireframeColor = .4
	terrainWireframe.material.color.setRGB(wireframeColor, wireframeColor, wireframeColor);

    mesh.add(terrainWireframe)

    // this.size = mapGenerator.size * scale;
    // this.terrain = mesh;

	
	this.update = function(time) {
	}
}