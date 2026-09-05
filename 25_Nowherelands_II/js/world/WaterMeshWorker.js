import { Heightmap } from './Heightmap.js';
import { WaterMeshData } from './WaterMeshData.js';

let mesh;
self.onmessage = ({ data }) => {
	if (data.type === 'init') {
		mesh = new WaterMeshData(new Heightmap(data.seed, data.world));
		self.postMessage({ type: 'ready' });
	} else if (data.type === 'near' && mesh) {
		const result = mesh.buildNear(data.x, data.z);
		const buffers = Object.values(result.attributes).map(a => a.array.buffer);
		buffers.push(result.index.buffer);
		self.postMessage({ type: 'near', id: data.id, x: data.x, z: data.z, data: result }, buffers);
	}
};
