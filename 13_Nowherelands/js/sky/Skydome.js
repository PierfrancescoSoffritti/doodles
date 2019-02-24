function Skydome(scene, terrainSize) {
	
	const stars = new Stars(scene, terrainSize);
	const snow = new Snow(scene, terrainSize);
	const moon = new Moon(scene, terrainSize);

	const speed = 0.01;
	this.update = function(time) {
		scene.background.setHSL(0.75, .5, (Math.sin(time * speed)+4) / 40);

		stars.update(time);
		snow.update(time);
		moon.update(time);
	}
}