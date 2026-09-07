// CPU/terrain-query replay on generated surface and cave terrain. Run with optional resolution and seed.
import { generateWorld } from '../js/world/gen/WorldGen.js';
import { generateCaves } from '../js/world/caves/CaveGen.js';
import { CaveField } from '../js/world/caves/CaveField.js';
import { erodeEntrances, EntranceTerrain } from '../js/world/caves/EntranceTerrain.js';
import { entranceHabitat } from '../js/world/caves/EntranceHabitat.js';
import { FaunaModel } from '../js/world/fauna/FaunaModel.js';
import { lumenLakes } from '../js/world/fauna/LumenSchool.js';
import { pebbleHabitatSites } from '../js/world/fauna/PebbleHabitats.js';
const seed = process.argv[3] || 'umbra'; globalThis.location = { search: '?seed=' + seed };
const { Heightmap } = await import('../js/world/Heightmap.js');
const world = generateWorld(seed, null, { res: Number(process.argv[2] || 512) }), hm = new Heightmap(seed, world);
world.caves = generateCaves(hm, seed); world.caveTerrain = erodeEntrances(hm, world.caves);
hm.entranceTerrain = new EntranceTerrain(world.caveTerrain); world.caveHabitat = entranceHabitat(hm, world.caves);
hm.caves = new CaveField(world.caves, world.caveHabitat.flatMap(h => h.rocks));
const sample = (x, z) => {
	const ground = hm.sample(x, z), water = hm._water, slope = hm._slope, hardness = hm._hardness, foam = hm._foam;
	const hab = hm.habitat(x, z), roof = hm.caves.surfaceDensity(x, ground, z) > -2;
	return { ground, water, slope, hardness, foam, roof, forest: hab.forest, wet: hab.wet, coast: hab.coast };
};

const sites=pebbleHabitatSites(world,lumenLakes(world,sample),hm,sample);
const reports=[];
for(const site of [null,...sites.filter(s=>s.id==='cave:0:mouth:0'||s.id==='cave:0:gallery:0:0.4')]) {
 let calls=0;const at=site?.sample||sample, timedSample=(x,z)=>{calls++;return at(x,z);};
 const model=new FaunaModel(seed,{sample:timedSample});
 const g=model.addGroup(site?'pebble-site:'+site.id:'arrival:hopper','hopper',site?.x||0,site?.z||0,site?.radius||140,site?{...site,sample:timedSample}:{});
 if(!g){reports.push({id:site?.id,count:0});continue;}
 const c=g.members[0];model.listener={x:c.pos.x+4,y:c.ground+11,z:c.pos.z};
 const frames=[];
 for(let i=0;i<600;i++) {calls=0;const t=performance.now();model.step(1/30);frames.push({time:model.time,ms:performance.now()-t,calls,states:g.members.map(c=>c.pebble.state)});}
 const sorted=frames.map(f=>f.ms).sort((a,b)=>a-b);
 reports.push({id:site?.id||'arrival',count:g.members.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),total:sorted.reduce((a,b)=>a+b,0),samples:frames.reduce((n,f)=>n+f.calls,0),worst:frames.sort((a,b)=>b.ms-a.ms).slice(0,6)});
}
console.log(JSON.stringify(reports,null,2));
