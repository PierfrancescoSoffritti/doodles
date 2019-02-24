function EndlessTerrain(scene, viewer, chunkSize) {
	
	const maxViewDistance = 450;

	const mapGenerator = new MapGenerator(200, 5, .5, 2, 0, [0, 0]);

	const viewerPosition = new THREE.Vector2();
	const chunksVisibleInViewDistance = Math.round(maxViewDistance / chunkSize);
	
	const terrainChunkDictionary = {};
	const terrainChunksVisibleLastUpdate = [];

	this.update = function() {
		viewerPosition.x = viewer.position.x;
		viewerPosition.y = viewer.position.z;
		this.updateVisibleChunks();	
	}

	this.updateVisibleChunks = function() {
		for(let i=0; i<terrainChunksVisibleLastUpdate.length; i++) {
			terrainChunksVisibleLastUpdate[i].setVisible(false);
		}
		terrainChunksVisibleLastUpdate.splice(0, terrainChunksVisibleLastUpdate.length)

		const currentChunkCoordX = Math.round(viewerPosition.x / chunkSize);
		const currentChunkCoordY = Math.round(viewerPosition.y / chunkSize);

		for(let yOffset = -chunksVisibleInViewDistance; yOffset <= chunksVisibleInViewDistance; yOffset++) {
			for(let xOffset = -chunksVisibleInViewDistance; xOffset <= chunksVisibleInViewDistance; xOffset++) {
				
				viewedChunkCoord = new THREE.Vector2(currentChunkCoordX + xOffset, currentChunkCoordY + yOffset);			

				if(terrainChunkDictionary[key(viewedChunkCoord)]) {
					const chunk = terrainChunkDictionary[key(viewedChunkCoord)];
					
					chunk.updateTerrainChunk();
					
					if(chunk.isVisible())
						terrainChunksVisibleLastUpdate.push(chunk)

				} else {
					terrainChunkDictionary[key(viewedChunkCoord)] = new TerrainChunk(viewedChunkCoord, chunkSize);
				}
			}
		}

		function key(vec2) {
			return vec2.x +"," +vec2.y;
		}
	}

	function TerrainChunk(coord, size) {
		const position = new THREE.Vector2(coord.x, coord.y).multiplyScalar(size);
		const positionV3 = new THREE.Vector3(position.x, 0, position.y);

		const map = mapGenerator.generateMap();
		const meshObject = new TerrainMeshGenerator().generateTerrainMesh(map, .4, 13, 5).createMesh();

		meshObject.position.set(positionV3.x, positionV3.y, positionV3.z);

		meshObject.visible = false;

		scene.add(meshObject);

		this.setVisible = function(visible) {
			meshObject.visible = visible;
		}

		this.updateTerrainChunk = function() {
			
			const dx = Math.max(Math.abs(viewerPosition.x - position.x) - size / 2, 0);
			const dy = Math.max(Math.abs(viewerPosition.y - position.y) - size / 2, 0);

			const distance = Math.sqrt(dx * dx + dy * dy);
			const visible = distance <= maxViewDistance;
			this.setVisible(visible);
		}

		this.isVisible = function() {
			return meshObject.visible;
		}
	}
}