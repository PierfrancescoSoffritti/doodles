function Skydome(scene, terrainSize) {
	
	const stars = new Stars(scene, terrainSize);
	const snow = new Snow(scene, terrainSize);
	const moon = new Moon(scene, terrainSize);

	this.update = function(time) {
		stars.update(time);
		snow.update(time);
		moon.update(time);
	}
}