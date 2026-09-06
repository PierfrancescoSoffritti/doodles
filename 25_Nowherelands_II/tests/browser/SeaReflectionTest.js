import { Vector3, Vector4 } from 'three';

// Run in the loaded app's browser console:
// await (await import('./tests/browser/SeaReflectionTest.js')).testSeaReflection()
// Uses the actual Reflector render callback. An identity texture matrix can look
// plausible against dark sky, so screenshots alone miss this regression.
export async function testSeaReflection(debug = window.__debug) {
	if (!debug) throw new Error('Load the island before checking its reflection.');
	const { player, camera, water, shared } = debug;
	const yaw = player.yaw, timeFactor = shared.timeFactor;
	const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	let maxError = 0, samples = 0;
	try {
		shared.timeFactor = 0;
		for (const turn of [0, 0.2, -0.25]) {
			player.yaw = yaw + turn;
			await nextFrame();
			const forward = camera.getWorldDirection(new Vector3());
			forward.y = 0; forward.normalize();
			const right = new Vector3(-forward.z, 0, forward.x);
			for (const distance of [40, 120, 350]) for (const side of [-0.2, 0, 0.2]) {
				const point = camera.position.clone().addScaledVector(forward, distance).addScaledVector(right, side * distance);
				point.y = water.uniforms.uWaterLevel.value;
				// Independently project through the reflected camera; its handedness
				// differs from the main view, so screen-space X cannot be reused.
				const ndc = point.clone().project(water.far.getReflectionCamera(camera));
				const uv = new Vector4(point.x, point.y, point.z, 1).applyMatrix4(water.uniforms.uReflMatrix.value);
				const error = Math.hypot(uv.x / uv.w - (ndc.x * 0.5 + 0.5), uv.y / uv.w - (ndc.y * 0.5 + 0.5));
				if (!Number.isFinite(error) || error > 1e-5) throw new Error(`Reflection projection drifted by ${error} at turn ${turn}, distance ${distance}.`);
				maxError = Math.max(maxError, error); samples++;
			}
		}
		return { samples, maxError };
	} finally {
		player.yaw = yaw;
		shared.timeFactor = timeFactor;
	}
}
