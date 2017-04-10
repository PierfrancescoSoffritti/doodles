function MapGenerator(noiseScale, octaves, persistance, lacunarity, seed, offset) {	

	const mapChunkSize = 241;
	const noise = new Noise();

	this.generateMap = function() {
		const noiseMap = noise.generateNoiseMap(mapChunkSize, mapChunkSize, seed, noiseScale, octaves, persistance, lacunarity, offset);

		return noiseMap;
	}

	this.requestMapData = function(callback) {
		const map = this.generateMap();
		callback(map);
	}
}