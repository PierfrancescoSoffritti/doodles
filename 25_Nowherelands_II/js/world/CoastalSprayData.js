// Extract sea-level contour crossings, then refine against the same terrain used
// for collision. Inland lakes and gently sloping beaches do not launch cliff spray.
export function coastalEmitters(world, heightmap) {
	const { res, height, cell, size, spawn } = world, result = [];
	const stride = 2;
	for (let z = 2; z < res - 3; z += stride) for (let x = 2; x < res - 3; x += stride) {
		const k = z * res + x;
		for (const [dx, dz] of [[stride, 0], [0, stride]]) {
			if ((height[k] > 0) === (height[k + dz * res + dx] > 0)) continue;
			let ax = x * cell - size / 2 - spawn.x, az = z * cell - size / 2 - spawn.z;
			let bx = ax + dx * cell, bz = az + dz * cell;
			let ah = heightmap.height(ax, az), bh = heightmap.height(bx, bz);
			if ((ah > 0) === (bh > 0)) continue;
			for (let n = 0; n < 8; n++) {
				const mx = (ax + bx) / 2, mz = (az + bz) / 2, mh = heightmap.height(mx, mz);
				if ((mh > 0) === (ah > 0)) { ax = mx; az = mz; ah = mh; } else { bx = mx; bz = mz; }
			}
			const px = (ax + bx) / 2, pz = (az + bz) / 2;
			const gx = heightmap.height(px + 16, pz) - heightmap.height(px - 16, pz);
			const gz = heightmap.height(px, pz + 16) - heightmap.height(px, pz - 16);
			const length = Math.hypot(gx, gz);
			if (length < 6) continue;
			const nx = -gx / length, nz = -gz / length;
			const rise = heightmap.height(px - nx * 32, pz - nz * 32);
			const bed = heightmap.height(px + nx * 32, pz + nz * 32);
			if (rise < 6 || bed > -1) continue;
			// height() also exposes the water body at the seaward sample. Exclude
			// raised lakes and the tidal river corridor even if their bed crosses zero.
			if (heightmap._water > 0.25 || heightmap._riverDist < heightmap._riverWidth * 0.5 + 40) continue;
			result.push({ x: px, z: pz, nx, nz, strength: Math.min(1, rise / 24) });
		}
	}
	return result;
}
