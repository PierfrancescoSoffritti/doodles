// Travelling animals continually pass, cross and roll around one another.
// These are individual trajectories with velocity feed-forward, rather than
// fixed offsets translated along with the flock. The launch blends into them.
export function flightSwirl(c, trail, time, amount) {
	const speed=Math.hypot(trail.vx,trail.vz);
	const dx=speed>1?trail.vx/speed:Math.cos(c.phase),dz=speed>1?trail.vz/speed:Math.sin(c.phase);
	const a=time*0.75*c.pace+c.phase,b=time*0.92*c.pace+c.phase,cross=time*0.43+c.phase*1.71;
	const lead=Math.sin(a)*34+Math.sin(time*0.31+c.phase*2)*15;
	const side=c.lateral*1.8+Math.sin(b)*34+Math.sin(cross)*14;
	const lift=c.flightOffset*0.7+Math.sin(time*0.83*c.pace+c.phase+1)*12;
	const forwardVelocity=Math.cos(a)*25.5*c.pace+Math.cos(time*0.31+c.phase*2)*4.65;
	const sideVelocity=Math.cos(b)*31.28*c.pace+Math.cos(cross)*6.02;
	return {x:(dx*lead-dz*side)*amount,y:lift*amount,z:(dz*lead+dx*side)*amount,
		vx:(dx*forwardVelocity-dz*sideVelocity)*amount,vy:Math.cos(time*0.83*c.pace+c.phase+1)*9.96*c.pace*amount,vz:(dz*forwardVelocity+dx*sideVelocity)*amount};
}
