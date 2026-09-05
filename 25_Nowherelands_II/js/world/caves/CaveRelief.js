// Continuous bedrock relief in world coordinates, shared by the cave floor and approach.
// No dependence on polyline sample indices: crossing a conduit segment cannot make a step.
function hash(x,z) { let n=Math.imul(x,374761393)^Math.imul(z,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295; }
export function rockNoise(x,z) {
	const i=Math.floor(x),j=Math.floor(z),a=x-i,b=z-j,u=a*a*(3-2*a),v=b*b*(3-2*b);
	return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v;
}
export function floorRelief(x,z) {
	const broad=(rockNoise(x/43,z/51)-.5)*14;
	const ledges=(rockNoise((x+z*.27)/14,(z-x*.18)/19)-.5)*7;
	const chips=(rockNoise(x/5.5,z/6.5)-.5)*.65;
	const i=Math.floor(x/17),j=Math.floor(z/17),cx=i*17+6+hash(i+31,j)*5,cz=j*17+6+hash(i,j+41)*5;
	const slab=hash(i-19,j)>.48?Math.max(0,Math.min(1,(1-Math.max(Math.abs(x-cx)/5.5,Math.abs(z-cz)/4))*2))*(1+hash(i,j)*2):0;
	return Math.tanh((broad+ledges+chips)/8)*8+slab;
}
