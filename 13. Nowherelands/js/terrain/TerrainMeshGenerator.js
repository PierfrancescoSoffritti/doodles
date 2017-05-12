function TerrainMeshGenerator() {

	this.generateTerrainMesh = function(heightMap, smoothThreshold, heightMultiplier, levelOfDetail) {
		if(levelOfDetail < 1 || levelOfDetail > 6) {
			console.error("levelOfDetail out of range");
			return;
		}

		const width = heightMap.length;
		const height = heightMap[0].length;
		const topLeftX = (width-1)/-2;
		const topLeftZ = (height-1)/2;

		const meshSimplificationIncrement = levelOfDetail * 2
		const verticesPerLine = (width-1)/meshSimplificationIncrement + 1

		const meshData = new MeshData(verticesPerLine, verticesPerLine);
		let vertexIndex = 0;

		for(let y=0; y<height; y += meshSimplificationIncrement) {
			for(let x=0; x<width; x += meshSimplificationIncrement) {

				// heightMap[x][y] = heightMap[x][y] < smoothThreshold ? 0 : Math.pow(heightMap[x][y]-smoothThreshold, 2)
				heightMap[x][y] = heightMap[x][y] < smoothThreshold ? 0 : Math.exp(heightMap[x][y] - smoothThreshold)-1;
				// heightMap[x][y] = heightMap[x][y] < smoothThreshold ? 0 : heightMap[x][y];
				meshData.vertices[vertexIndex] = new THREE.Vector3(topLeftX + x, heightMap[x][y] * heightMultiplier, topLeftZ - y);
				meshData.uvs[vertexIndex] = new THREE.Vector2(x/width, y/height);

				if(x < width-1 && y < height-1) {
					meshData.addTriangle(vertexIndex, vertexIndex+verticesPerLine+1, vertexIndex+verticesPerLine)
					meshData.addTriangle(vertexIndex+verticesPerLine+1, vertexIndex, vertexIndex+1)
				}

				vertexIndex++;
			}
		}

		return meshData;
	}

	function MeshData(meshWidth, meshHeight) {
		this.vertices = []; // len == meshWidth * meshHeight
		this.triangles = []; // len == (meshWidth-1) * (meshHeight-1) *6

		this.uvs = []; // len = meshWidth * meshHeight

		this.addTriangle = function(a, b, c) {
			this.triangles.push(new THREE.Face3(a,b,c))
		}

		this.createMesh = function(cubeCamera) {
			var geometry = new THREE.Geometry(); 
			
			geometry.vertices = this.vertices;
			geometry.faces = this.triangles;
			geometry.faceVertexUvs = this.uvs;

			geometry.computeVertexNormals();

			var mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: "#000001", shading: THREE.SmoothShading,
				metalness: .0, roughness: 1 }));

			mesh.material.envMap = cubeCamera.renderTarget.texture;
			return mesh;
		}
	}
}