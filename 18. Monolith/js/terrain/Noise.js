function Noise() {

	this.generateNoiseMap = function(mapWidth, mapHeight, seed, scale, octaves, persistance, lacunarity, offset) { 
		noiseMap = [];

		const prng = new Random(seed);

		const simplex = new SimplexNoise(prng);

		const octavesOffsets =[];
		for(let i=0; i<octaves; i++) {
			octavesOffsets.push( [ prng.next() +offset[0], prng.next() +offset[1] ] )
		}

		if(scale <= 0)
			scale = 0.0001;

		const halfWidth = mapWidth/2;
		const halfHeight = mapHeight/2;

		for(let y=0; y<mapHeight; y++) {
			noiseMap.push([]);
			for(let x=0; x<mapWidth; x++) {

				let amplitude = 1;
				let frequency = 1;
				let noiseHeight = 0;

				for(let i=0; i<octaves; i++) {
					const sampleX = (x-halfWidth) /scale * frequency + octavesOffsets[i][1];
					const sampleY = (y-halfHeight) /scale * frequency + octavesOffsets[i][0];

					const noiseValue = simplex.noise(sampleX, sampleY);
					noiseHeight += noiseValue * amplitude;

					amplitude *= persistance;
					frequency *= lacunarity;
				}

				noiseMap[y].push(noiseHeight);
			}
		}

		// normalize
		for(let y=0; y<mapHeight; y++) {
			for(let x=0; x<mapWidth; x++) {
				noiseMap[x][y] = (noiseMap[x][y]+1)/2;

				if(noiseMap[x][y] > 1)
					noiseMap[x][y] = 1;
			}
		}

		return noiseMap;
	}
}