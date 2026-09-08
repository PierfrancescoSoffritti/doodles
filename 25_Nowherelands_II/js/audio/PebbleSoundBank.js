// Short, deterministic foley samples. Generated once per variant, then reused.
export const PEBBLE_SOUNDS = {
 startle: {seconds:.34,level:.54,range:180},
 step: {seconds:.12,level:.4,range:130},
 settle: {seconds:.26,level:.36,range:110},
 splash: {seconds:.3,level:.34,range:130},
 paddle: {seconds:.16,level:.25,range:110},
 drip: {seconds:.22,level:.18,range:85},
 creak: {seconds:.42,level:.135,range:40},
};

export function pebbleSamples(event, rate, variant=0) {
 const spec=PEBBLE_SOUNDS[event]; if(!spec)throw new Error('Unknown pebble sound: '+event);
 const data=new Float32Array(Math.ceil(rate*spec.seconds));
 let random=7919+variant*104729, low=0, phase=0, peak=0;
 const pitch=1+(variant-1)*.07, tau=Math.PI*2;
 for(let i=0;i<data.length;i++) {
  const t=i/rate;
  random=(Math.imul(random,1664525)+1013904223)>>>0;
  const noise=random/2147483648-1;low=low*.83+noise*.17;
  const grit=noise-low;
  const tick=(hz,decay)=>Math.sin(t*tau*hz*pitch)*Math.exp(-t/decay);
  let v=0;
  if(event==='startle') {
   // A mineral click followed by a small, breathy, descending squeak.
   phase+=tau*(850-450*Math.min(1,t/.24))*pitch/rate;
   const voice=Math.max(0,Math.sin(Math.PI*Math.min(1,t/.3)))**2;
   v=.65*tick(1050,.026)+.25*tick(2780,.012)+voice*(.6*Math.sin(phase)+.12*grit);
  } else if(event==='step' || event==='settle') {
   const settling=event==='settle';
   v=.8*tick(settling?260:650,settling?.055:.025)+.35*tick(settling?740:1710,.018)+.28*grit*Math.exp(-t/(settling?.055:.028));
   if(settling)v+=.2*tick(115,.075);
  } else if(event==='creak') {
   phase+=tau*(420+90*Math.sin(t*13))*pitch/rate;
   v=(Math.sin(phase)*.24+low*.7)*Math.sin(Math.PI*t/spec.seconds)**2*(.6+.4*Math.sin(t*81)**2);
  } else {
   // Small water bursts with a rounded bubble beneath the splash.
   const drip=event==='drip', attack=drip?.025:.008, decay=event==='splash'?.09:.05;
   const env=Math.min(1,t/attack)*Math.exp(-t/decay);
   phase+=tau*(drip?1100-500*Math.min(1,t/.15):380+900*t)*pitch/rate;
   v=env*((drip?.25:event==='paddle'?.12:.8)*grit+low*(event==='paddle'?1.2:.8)+Math.sin(phase)*(drip?.8:.3));
  }
  v*=Math.min(1,t/.002, (spec.seconds-t)/.012);
  data[i]=v;peak=Math.max(peak,Math.abs(v));
 }
 for(let i=0;i<data.length;i++)data[i]*=.9/Math.max(peak,.0001);
 return data;
}

export function pebbleImpulse(ctx) {
 const buffer=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*1.8),ctx.sampleRate);
 let seed=73;
 for(let ch=0;ch<2;ch++) {
  const data=buffer.getChannelData(ch);let low=0;
  for(let i=Math.floor(ctx.sampleRate*.035);i<data.length;i++) {
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;low=low*.7+(seed/2147483648-1)*.3;
   data[i]=low*Math.exp(-i/ctx.sampleRate*4);
  }
 }
 return buffer;
}
