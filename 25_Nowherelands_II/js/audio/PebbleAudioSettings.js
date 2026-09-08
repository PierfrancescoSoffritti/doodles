const KEY='nowherelands:pebble-volume';
const listeners=new Set();
const normalize=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1.5,Number(value))):1;
export function readPebbleVolume() {
 try {const value=globalThis.localStorage?.getItem(KEY);return value===null || value===undefined?1:normalize(value);}catch{return 1;}
}
export function savePebbleVolume(value) {
 value=normalize(value);
 try {globalThis.localStorage?.setItem(KEY,String(value));}catch{}
 for(const listener of listeners)listener(value);
}
export function watchPebbleVolume(listener,events=globalThis) {
 const refresh=()=>listener(readPebbleVolume());
 const storage=event=>{if(event.key===KEY || event.key===null)refresh();};
 listeners.add(listener);events.addEventListener?.('storage',storage);events.addEventListener?.('focus',refresh);refresh();
 return ()=>{listeners.delete(listener);events.removeEventListener?.('storage',storage);events.removeEventListener?.('focus',refresh);};
}
