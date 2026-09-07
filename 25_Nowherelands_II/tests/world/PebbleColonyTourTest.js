import test from 'node:test';
import assert from 'node:assert/strict';
import { PebbleColonyTour } from '../../js/world/fauna/PebbleColonyTour.js';

const group = (id, x=0) => ({id, kind:'hopper', home:{x,z:0}, members:[{}]});

test('the tour visits unloaded world sites before returning to nearby colonies', () => {
 const tour=new PebbleColonyTour([{id:'cave',x:4000,z:0},{id:'lake',x:8000,z:0}]);
 const nearby=[group('a'),group('b',20),group('c',40)];tour.remember(nearby);
 let current=nearby[0];const visited=[];
 for(let i=0;i<5;i++){current=tour.next(current,s=>group(s.id,s.x));visited.push(current.id);}
 assert.deepEqual(visited,['pebble-site:cave','pebble-site:lake','b','c','pebble-site:cave']);
});

test('remembered destinations survive streaming eviction across a full tour', () => {
 const sites=Array.from({length:12},(_,i)=>({id:String(i).padStart(2,'0'),x:i*2000,z:0}));
 const tour=new PebbleColonyTour(sites),loaded=new Map();let current;const visited=[];
 const load=s=>{loaded.clear();const g=group(s.id,s.x);loaded.set(g.id,g);return g;};
 for(let i=0;i<12;i++){current=tour.next(current,load);tour.remember(loaded.values());visited.push(current.id);}
 assert.equal(new Set(visited).size,12);assert.equal(loaded.size,1);
 assert.equal(tour.next(current,load).id,visited[0]);
});

test('unusable sites are skipped without stranding the tour or revisiting the current colony', () => {
 const tour=new PebbleColonyTour([{id:'a',x:0,z:0},{id:'bad',x:0,z:0},{id:'z',x:0,z:0}]);
 const a=group('pebble-site:a');
 assert.equal(tour.next(a,s=>s.id.endsWith('bad')?null:group(s.id)).id,'pebble-site:z');
});

test('discovered gravel colonies remain destinations after their groups unload', () => {
 const tour=new PebbleColonyTour();const a=group('gravel-a',500),b=group('gravel-b',2000);tour.remember([a,b]);
 const loaded=[];assert.equal(tour.next(a,s=>{loaded.push(s);return group(s.id,s.x);}).id,b.id);
 assert.equal(loaded[0].x,2000);
});

test('newly streamed local colonies cannot starve the remaining world destinations', () => {
 const tour=new PebbleColonyTour(Array.from({length:8},(_,i)=>({id:'cave-'+i,x:i*2000,z:0})));
 let current=group('arrival');tour.remember([current]);
 for(let i=0;i<8;i++){
  tour.remember([group('local-'+i)]);
  current=tour.next(current,s=>group(s.id,s.x));assert.equal(current.id,'pebble-site:cave-'+i);
 }
});
