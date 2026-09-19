import { Heightmap } from './Heightmap.js?v=stable-30-6';
import { terrainMeshData, terrainMeshSteps } from './TerrainMeshData.js?v=stable-30-23';
import { shoreTileData, shoreTileSteps } from './ShoreTileData.js?v=stable-30-23';
import { WaterMeshData } from './WaterMeshData.js?v=stable-30-23';
import { createLumenRuntime } from './fauna/LumenWorkerRuntime.js?v=streaming-60-30-19';

let heightmap, water, cooperative = false, task = null;
function transfer(result) {
 return result.attributes
  ? [...Object.values(result.attributes).map(a => a.array.buffer), result.index.buffer]
  : Object.values(result).map(a => a.buffer);
}

// Yield between complete samples so simulation messages can use the same
// heightmap safely. A single geometry job retains its own construction state.
function pump() {
 if (!task) return;
 const current = task, started = performance.now(), deadline = started + 2;
 try {
  do {
   const step = current.work.next();
   if (step.done) {
    const ms = performance.now() - started;
    task = null;
    self.postMessage({ id: current.id, result: step.value,
     workMs: current.workMs + ms, maxSliceMs: Math.max(current.maxSliceMs, ms) }, transfer(step.value));
    return;
   }
  } while (performance.now() < deadline);
  const ms = performance.now() - started;
  current.workMs += ms; current.maxSliceMs = Math.max(current.maxSliceMs, ms);
  setTimeout(pump, 0);
 } catch (error) {
  task = null;
  self.postMessage({ id: current.id, error: String(error) });
 }
}

self.onmessage = ({ data }) => {
 try {
  if (data.type === 'init') {
   heightmap = new Heightmap(data.seed, data.world);
   self.postMessage({ type: 'ready' }); return;
  }
  if (data.type === 'simulation') {
   // Preparation happens while the simulation's startup handshake is pending.
   water ||= new WaterMeshData(heightmap); cooperative = true;
   const port = data.port;
   const runtime = createLumenRuntime(heightmap, (message, transfer = []) => port.postMessage(message, transfer));
   port.onmessage = event => {
    if (event.data.type === 'dispose') { port.onmessage = null; port.close(); }
    else runtime(event);
   };
   return;
  }
  if (data.type === 'water') water ||= new WaterMeshData(heightmap);
  if (cooperative) {
   if (task) throw Error('Surface worker received overlapping jobs');
   task = { id: data.id, workMs: 0, maxSliceMs: 0,
    work: data.type === 'water' ? water.buildNearSteps(data.x, data.z)
     : data.type === 'terrain' ? terrainMeshSteps(heightmap, data.depth, data.ix, data.iz)
     : shoreTileSteps(heightmap, data) };
   setTimeout(pump, 0); return;
  }
  const result = data.type === 'water' ? water.buildNear(data.x, data.z)
   : data.type === 'terrain' ? terrainMeshData(heightmap, data.depth, data.ix, data.iz)
   : shoreTileData(heightmap, data);
  self.postMessage({ id: data.id, result }, transfer(result));
 } catch (error) {
  if (data.type === 'simulation') {
   data.port.postMessage({ type: 'error', message: String(error) }); data.port.close();
  } else self.postMessage({ id: data.id, error: String(error) });
 }
};
