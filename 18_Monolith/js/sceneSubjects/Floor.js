function Floor(scene, gameConstants) {
	
	this.group = new THREE.Group()
	scene.add(this.group)

	const pillarGeometry = new THREE.BoxBufferGeometry( 1, 1, 1 )

	for(let i=0; i<300; i++)
		placePillarOnMapBorder(this.group, pillarGeometry, gameConstants.maxRadius+20, gameConstants.maxRadius+50)

	createTerrain(this.group)
	
	this.update = function(time) {
	}

	function placePillarOnMapBorder(group, pillarGeometry, radiusMin, radiusMax) {
		const radius = getRandom(radiusMin, radiusMax)
		const angle = getRandom(0, Math.PI*2)

		const pillarColor = getRandom(.2, .9)
	
		const pillarMaterial = new THREE.MeshBasicMaterial()
		pillarMaterial.color.setRGB(pillarColor, pillarColor, pillarColor)

		var pillarMesh = new THREE.Mesh(pillarGeometry, pillarMaterial)

		pillarMesh.scale.set( getRandomInt(5,30), getRandomInt(5,50), getRandomInt(5,30) )

		const cartesianCoords = polarToCartesian(radius, angle)
		pillarMesh.position.set(cartesianCoords.x, 0, cartesianCoords.y)
		
		group.add(pillarMesh)
	}

	function createTerrain(group) {
		
		const mapArgs = {
			noiseScale: 150,
			octaves: 5,
			persistance: .5,
			lacunarity: 20,
			seed: Math.random(),
			offset: [0, 0],
			useFalloff: false
		}
	
		const mapGenerator = new MapGenerator(mapArgs)
		const heightMap = mapGenerator.generateMap()
		
		const terrainMeshArgs = {
			heightMap: heightMap,
			smoothThreshold: .4,
			heightMultiplier: 12,
			levelOfDetail: 2
		}
	
		const terrainMesh = new TerrainMeshGenerator().generateTerrainMesh(terrainMeshArgs).createMesh()
	
		const terrainWireframe = new THREE.LineSegments(
			new THREE.EdgesGeometry(terrainMesh.geometry),
			new THREE.LineBasicMaterial()
		)
		const wireframeColor = .4
		terrainWireframe.material.color.setRGB(wireframeColor, wireframeColor, wireframeColor)
	
		terrainMesh.add(terrainWireframe)
		group.add(terrainMesh)
	}
}