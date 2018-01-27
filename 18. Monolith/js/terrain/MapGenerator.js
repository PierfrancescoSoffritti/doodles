function MapGenerator(noiseScale, octaves, persistance, lacunarity, seed, offset, useFalloff) {	

	const mapChunkSize = 441;
	this.size = mapChunkSize;
	
	const noise = new Noise();

	let falloffMap;
	if(useFalloff)
		falloffMap = new FalloffGenerator().generateFalloffMap(mapChunkSize);

	this.generateMap = function() {
		const noiseMap = noise.generateNoiseMap(mapChunkSize, mapChunkSize, seed, noiseScale, octaves, persistance, lacunarity, offset);

		if(useFalloff) {
			for(let y=0; y<noiseMap.length; y++) {
				for(let x=0; x<noiseMap[0].length; x++){
					noiseMap[x][y] = clamp01(noiseMap[x][y] - falloffMap[x][y]);
				}
			}
		}

		return noiseMap;
	}

	this.requestMapData = function(callback) {
		const map = this.generateMap();
		callback(map);
	}
}