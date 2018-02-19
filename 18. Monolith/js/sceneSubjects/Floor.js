function Floor(scene, gameConstants) {

	const colors = ["#444"] //, "#9C27B0", "#3F51B5", "#4CAF50"]
	
	this.group = new THREE.Group();
	scene.add(this.group);

	const pillarGeometry = new THREE.BoxBufferGeometry( 1, 1, 1 );

	for(let i=0; i<300; i++)
		placePillar(this.group, gameConstants.maxRadius+20, gameConstants.maxRadius+50)

	function placePillar(group, radiusMin, radiusMax) {
		const radius = getRandom(radiusMin, radiusMax)
		const angle = getRandom(0, Math.PI*2)

		const pillarColor = getRandom(.2, .9)

		const x = radius * cos(angle)
        const y = 0
        const z = radius * sin(angle)
	
		var pillarMaterial = new THREE.MeshBasicMaterial( );
		pillarMaterial.color.setRGB(pillarColor, pillarColor, pillarColor);

		var pillar = new THREE.Mesh( pillarGeometry, pillarMaterial );

		pillar.scale.set( getRandomInt(5,30), getRandomInt(5,50), getRandomInt(5,30) )

		pillar.position.set(x, y, z)
		group.add(pillar)
	}

	const mapGenerator = new MapGenerator(150, 5, .5, 20, Math.random(), [0, 0], false);
    const map = mapGenerator.generateMap();

    // terrain
    const mesh = new TerrainMeshGenerator().generateTerrainMesh(map, .4, 8, 2).createMesh();
    scene.add(mesh);

    // terrain wireframe
    const terrainWireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial()
	)
	const wireframeColor = .4
	terrainWireframe.material.color.setRGB(wireframeColor, wireframeColor, wireframeColor)

    mesh.add(terrainWireframe)

	
	this.update = function(time) {
	}
}