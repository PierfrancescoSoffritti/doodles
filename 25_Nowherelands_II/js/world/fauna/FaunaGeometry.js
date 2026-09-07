import * as THREE from 'three';

function grid(rows, columns, vertex) {
	const positions = [], uvs = [], indices = [];
	for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
		positions.push(...vertex(i / rows, j / columns)); uvs.push(i / rows, j / columns);
	}
	for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
		const a = i * (columns + 1) + j, b = a + columns + 1;
		indices.push(a, a + 1, b, a + 1, b + 1, b);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals();
	return g;
}

export function faunaGeometry(kind) {
	if (kind === 'lumen') {
		// A directionless sphere; all motion-driven shape changes happen in the shader.
		const g = grid(28, 24, (u, v) => {
			const x = -Math.cos(u * Math.PI), radius = Math.sin(u * Math.PI);
			return [x, Math.cos(v * Math.PI * 2) * radius, Math.sin(v * Math.PI * 2) * radius];
		});
		// The duplicate seam vertices need identical smooth normals, including poles.
		const p = g.attributes.position, n = g.attributes.normal;
		for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), length = Math.hypot(x, y, z); n.setXYZ(i, x / length, y / length, z / length); }
		return g;
	}
	throw new Error('Unsupported fauna geometry: ' + kind);
}
