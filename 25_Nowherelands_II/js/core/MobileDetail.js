// Explicit flags support repeatable comparisons on the actual device.
const choice = new URLSearchParams(globalThis.location?.search || '').get('mobileDetail');
export const mobileDetail = choice === '1' || (choice !== '0' && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches);

// Low-memory phones need a bounded rendering budget. Keep explicit overrides
// for device comparisons, and preserve the user's frame-rate selection.
export const lowMemoryMobile = mobileDetail && (globalThis.navigator?.deviceMemory || 8) <= 4;
export function mobileOption(name, fallback = lowMemoryMobile) {
 const value=new URLSearchParams(globalThis.location?.search || '').get(name);
 return value==='1'||(value!=='0'&&fallback);
}
