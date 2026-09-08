import test from 'node:test';
import assert from 'node:assert/strict';
import { readPebbleVolume, savePebbleVolume, watchPebbleVolume } from '../../js/audio/PebbleAudioSettings.js?v=pebble-audio-10';

test('volume follows same-tab edits, other tabs and focus, and unsubscribes cleanly',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const values=new Map(),events=new EventTarget(),seen=[];
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
 const off=watchPebbleVolume(v=>seen.push(v),events);
 try {
  assert.equal(seen.at(-1),1);
  savePebbleVolume(0);assert.equal(seen.at(-1),0);
  savePebbleVolume(1.2);assert.equal(seen.at(-1),1.2);
  const key='nowherelands:pebble-volume';values.set(key,'.8');
  const changed=new Event('storage');changed.key=key;events.dispatchEvent(changed);assert.equal(seen.at(-1),.8);
  values.set(key,'1');events.dispatchEvent(new Event('focus'));assert.equal(seen.at(-1),1);
  values.set(key,'broken');assert.equal(readPebbleVolume(),1);
  savePebbleVolume(10);assert.equal(readPebbleVolume(),1.5);
  savePebbleVolume(-2);assert.equal(readPebbleVolume(),0);
  off();const count=seen.length;savePebbleVolume(.5);events.dispatchEvent(new Event('focus'));assert.equal(seen.length,count);
 } finally {off();if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});
