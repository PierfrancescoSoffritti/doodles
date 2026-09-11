// One radius for the player note and the outer edge of its visible circle.
export const RIPPLE_LIFETIME=.7;
export const rippleWidth=size=>1+.6*Math.min(size,3);
export const playerNoteRadius=velocity=>82.5+82.5*Math.max(0,Math.min(1,((velocity??.35)-.35)/.6));
export const rippleMaxRadius=size=>(14+9*size)*6;
export const rippleEase=t=>{t=Math.max(0,Math.min(1,t));return 1.3*t-.3*t*t;};
export const rippleRadius=(maxRadius,age)=>maxRadius*rippleEase(age/RIPPLE_LIFETIME);
