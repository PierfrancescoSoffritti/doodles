import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainMeshData } from '../../js/world/TerrainMeshData.js';
import { shoreTileData, fillShoreRows } from '../../js/world/ShoreTileData.js';
import { shoreDistance, riverReach } from '../../js/world/ShoreMapData.js';

const hm = {
	height(x,z) { return Math.sin(x/27)*8 + Math.cos(z/41)*4; },
	sample(x,z) { this._water = 2; this._riverDist = Math.abs(x); this._riverWidth = 8; return this.height(x,z); },
	entranceTerrain: { sample(x,z) { return Math.exp(-(x*x+z*z)/500); } },
	caves: { surfaceDensity(x,y,z) { return y - Math.sin(z/70) - 2; } },
};
test('terrain data preserves sampling, skirt continuity and cave masks at every detail level', () => {
	for (const depth of [0, 5, 8, 9]) {
		const { pos, apron, caveMask } = terrainMeshData(hm, depth, 0, 0), n = 49;
		assert.equal(pos.length/3, n*n+4*n);
		for (let i=0;i<n*n;i++) assert.ok(Math.abs(pos[i*3+1]-hm.height(pos[i*3],pos[i*3+2]))<.001);
		const skirt = 40960/(1<<depth)/48*.22+2.5;
		for(let edge=0;edge<4;edge++)for(let k=0;k<n;k++){
			const a=[k,48*n+k,k*n,k*n+48][edge], b=n*n+edge*n+k;
			assert.equal(pos[b*3],pos[a*3]);assert.equal(pos[b*3+2],pos[a*3+2]);
			assert.ok(Math.abs(pos[a*3+1]-pos[b*3+1]-skirt)<.001);
		}
		assert.ok(apron.every(Number.isFinite)); assert.ok(caveMask.every(v=>Number.isFinite(v)&&v>=-32&&v<=32));
	}
});
test('complete worker shore tiles exactly match incremental rows, including distance and river reach', () => {
	for (const [ox,oz] of [[0,0],[-120,256],[768,-1024]]) {
		const spec={res:64,size:640,ox,oz}, a=shoreTileData(hm,spec).data, b=new Float32Array(a.length);
		for(let row=0;row<64;row+=7)fillShoreRows(b,hm,64,640,ox,oz,row,Math.min(64,row+7));
		shoreDistance(b,64,640/63);riverReach(b,64,640/63);
		assert.deepEqual(a,b);
	}
});
