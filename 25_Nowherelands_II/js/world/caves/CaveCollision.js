// Sweep rather than checking only the endpoint: sprint/fly frames cannot jump a thin wall.
export function sweepFlight(hm,from,target,clearance=2.5) {
	const result={...from},distance=Math.hypot(target.x-from.x,target.y-from.y,target.z-from.z),steps=Math.max(1,Math.ceil(distance/1.25));
	for(let i=1;i<=steps;i++) {
		const t=i/steps,x=from.x+(target.x-from.x)*t,y=from.y+(target.y-from.y)*t,z=from.z+(target.z-from.z)*t;
		const air=Math.max(y-hm.height(x,z),hm.caves.density(x,y,z));
		if(air<clearance || hm.caves.rockClearance(x,y,z)<clearance)break;
		Object.assign(result,{x,y,z});
	}
	return result;
}
export function sweepWalk(hm,from,target,eyeHeight=11) {
	const result={...from},distance=Math.hypot(target.x-from.x,target.z-from.z),steps=Math.max(1,Math.ceil(distance/1.25));
	for(let i=1;i<=steps;i++) {
		const t=i/steps,x=from.x+(target.x-from.x)*t,z=from.z+(target.z-from.z)*t;
		const surface=hm.height(x,z),q=hm.caves.column(x,z,result.y,eyeHeight);
		// Above the hillside the cave shell has been clipped away. Its nominal floor
		// and rounded end must not become an invisible bridge or wall outside the mouth.
		const underground=q && q.floor<surface, floor=underground?q.floor:surface,water=underground?q.water:hm.waterAt(x,z);
		const ground=Math.max(floor,water-1.5),y=ground+eyeHeight;
		if(hm.caves.rockClearance(x,ground+eyeHeight*.5,z)<2 || hm.caves.rockClearance(x,y,z)<2 || y>result.y+2.4 || (q && ((surface>y+2 && q.ceiling<y+2) || Math.max(ground+1.5-surface,hm.caves.density(x,ground+1.5,z))<1)))break;
		Object.assign(result,{x,y,z});
	}
	return result;
}
