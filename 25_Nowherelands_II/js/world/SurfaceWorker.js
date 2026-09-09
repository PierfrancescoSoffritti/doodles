import { Heightmap } from './Heightmap.js';
import { terrainMeshData } from './TerrainMeshData.js';
import { shoreTileData } from './ShoreTileData.js';
let heightmap;
self.onmessage = ({ data }) => {
	try {
		if (data.type === 'init') {
			heightmap = new Heightmap(data.seed, data.world); self.postMessage({ type: 'ready' }); return;
		}
		const result = data.type === 'terrain' ? terrainMeshData(heightmap, data.depth, data.ix, data.iz) : shoreTileData(heightmap, data);
		self.postMessage({ id: data.id, result }, Object.values(result).map(a => a.buffer));
	} catch (error) { self.postMessage({ id: data.id, error: String(error) }); }
};
