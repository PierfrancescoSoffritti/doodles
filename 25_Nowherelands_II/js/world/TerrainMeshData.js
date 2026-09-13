const SEG = 48, ROOT = 40960;

export function* terrainMeshSteps(heightmap, depth, ix, iz) {
		const size = ROOT / (1 << depth);
		const cx = -ROOT / 2 + (ix + 0.5) * size, cz = -ROOT / 2 + (iz + 0.5) * size;
		const n = SEG + 1, step = size / SEG;
		const skirt = step * 0.22 + 2.5;
		const pos = new Float32Array((n * n + 4 * n) * 3);
		const hm = heightmap;
		let p = 0;
		for (let j = 0; j < n; j++) {
			const z = cz - size / 2 + j * step;
			for (let i = 0; i < n; i++) {
				const x = cx - size / 2 + i * step;
				pos[p++] = x; pos[p++] = hm.height(x, z); pos[p++] = z;
                if((i&7)===7)yield;
			}
		}
		const copyDown = (gi) => { pos[p++] = pos[gi * 3]; pos[p++] = pos[gi * 3 + 1] - skirt; pos[p++] = pos[gi * 3 + 2]; };
		for (let k = 0; k < n; k++) copyDown(k);
		for (let k = 0; k < n; k++) copyDown(SEG * n + k);
		for (let k = 0; k < n; k++) copyDown(k * n);
		for (let k = 0; k < n; k++) copyDown(k * n + SEG);

		const apron=new Float32Array(pos.length/3), caveMask=new Float32Array(pos.length/3);
		for(let i=0;i<apron.length;i++){apron[i]=hm.entranceTerrain.sample(pos[i*3],pos[i*3+2],'mask');if((i&63)===63)yield;}
		for(let i=0;i<caveMask.length;i++){caveMask[i]=Math.max(-32,Math.min(32,hm.caves.surfaceDensity(pos[i*3],pos[i*3+1],pos[i*3+2])));if((i&31)===31)yield;}
		return { pos, apron, caveMask };
}

export function terrainMeshData(...args){const work=terrainMeshSteps(...args);for(;;){const step=work.next();if(step.done)return step.value;}}
