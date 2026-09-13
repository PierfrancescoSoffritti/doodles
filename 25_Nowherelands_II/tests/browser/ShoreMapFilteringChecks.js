import * as THREE from 'three';
import { ShoreMap } from '../../js/world/ShoreMap.js?v=water-float-filter-1';

// Read back the production shoreline shader in both shader stages. Heights above
// 1000 m and a 12.5 cm depth distinguish float32 interpolation from half-float
// rounding, nearest-neighbour sampling, and incomplete textures returning black.
export function checkShoreMapFiltering() {
	const renderer = new THREE.WebGLRenderer();
	const gl = renderer.getContext();
	const linear = renderer.extensions.has('OES_texture_float_linear');
	const res = 9, size = 8192;
	const map = new ShoreMap({ ox: 0, oz: 0, waterLevel: 0, world: {
		res, size, height: new Float32Array(res * res), lakeLevel: new Float32Array(res * res),
	} }, null, renderer);
	const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
	const geometry = new THREE.PlaneGeometry(2, 2);
	const camera = new THREE.Camera(), scene = new THREE.Scene();
	const point = { value: new THREE.Vector2() }, pixel = new Uint8Array(4);
	const textures = [map.tiers[0].texture, map.tiers[1].texture, map.coastTexture];
	let checks = 0, maxByteError = 0;
	const check = (ok, message) => { if (!ok) throw Error(message); checks++; };
	try {
		for (const texture of textures) {
			const { data, width, height } = texture.image;
			for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;
				data[i] = 1000 + (x % 7) * .25 + (y % 5) * .125;
				data[i + 1] = data[i] + .125;
				data[i + 2] = (x % 5) - 2;
				data[i + 3] = (y % 4) / 4;
			}
			texture.needsUpdate = true;
		}
		for (const vertex of [false, true]) {
			const material = new THREE.ShaderMaterial({
				uniforms: { ...map.uniforms, uPoint: point },
				vertexShader: `${vertex ? map.glsl : ''}
					uniform vec2 uPoint; varying vec4 sampled;
					void main() { ${vertex ? 'sampled = shoreSample(uPoint);' : ''} gl_Position = vec4(position, 1.); }`,
				fragmentShader: `${vertex ? '' : map.glsl}
					uniform vec2 uPoint; varying vec4 sampled;
					void main() { vec4 s = ${vertex ? 'sampled' : 'shoreSample(uPoint)'};
						gl_FragColor = vec4((s.r - 1000.) / 4., (s.g - s.r) * 4., (s.b + 2.) / 4., s.a); }`,
			});
			const mesh = new THREE.Mesh(geometry, material); scene.add(mesh);
			try {
				for (let tier = 0; tier < 3; tier++) {
					const texture = textures[tier], span = tier < 2 ? map.tiers[tier].spec.size : size;
					// Isolate each tier without bypassing its production sampling code.
					map.uniforms.uShoreNearOrigin.value.set(tier === 0 ? 0 : 1e6, 0);
					map.uniforms.uShoreFarOrigin.value.set(tier === 1 ? 0 : 1e6, 0);
					const samples = [[.5, .5], [.5073, .4891], [.1271, .7643]];
					if (tier === 2) samples.push([0, 0], [1, 1], [0, .51], [1, .49]);
					for (const [u, v] of samples) {
						point.value.set((u - .5) * span, (v - .5) * span);
						const uv = tier === 2 ? [u * (1 - 1/res) + .5/res, v * (1 - 1/res) + .5/res] : [u, v];
						const s = bilinear(texture.image, ...uv);
						const expected = [(s[0] - 1000)/4, (s[1] - s[0])*4, (s[2] + 2)/4, s[3]];
						renderer.setRenderTarget(target); renderer.render(scene, camera);
						renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
						for (let c = 0; c < 4; c++) {
							const error = Math.abs(pixel[c] - Math.round(expected[c]*255));
							maxByteError = Math.max(maxByteError, error);
							check(error <= 1, `${vertex ? 'Vertex' : 'Fragment'} tier ${tier}, UV ${u},${v}, channel ${c}: got ${pixel[c]}, expected ${expected[c]*255}`);
						}
					}
				}
			} finally { scene.remove(mesh); material.dispose(); }
		}
		check(gl.getError() === gl.NO_ERROR, 'WebGL error during shoreline sampling');
		return { checks, linear, maxByteError };
	} finally {
		geometry.dispose(); target.dispose(); textures.forEach(texture => texture.dispose()); renderer.dispose();
	}
}

function bilinear({ data, width, height }, u, v) {
	const x = u * width - .5, y = v * height - .5, ix = Math.floor(x), iy = Math.floor(y);
	const result = [0, 0, 0, 0];
	for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
		const weight = (dx ? x-ix : 1-x+ix) * (dy ? y-iy : 1-y+iy);
		const i = (Math.max(0, Math.min(height-1, iy+dy)) * width + Math.max(0, Math.min(width-1, ix+dx))) * 4;
		for (let c = 0; c < 4; c++) result[c] += data[i+c] * weight;
	}
	return result;
}
