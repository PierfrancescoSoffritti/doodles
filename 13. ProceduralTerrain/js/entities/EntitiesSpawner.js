function EntitiesSpawner(scene, player, collisionManager, terrainSize) {

	const cylinders = new Cylinders(scene, player, collisionManager);
	const grass = new Grass(scene, player, collisionManager);
	const trees = new Trees(scene, player, collisionManager);
	const sprouts = new Sprouts(scene, player, collisionManager, terrainSize);
	const elusiveEntity = new ElusiveEntity(scene, player, collisionManager);

	this.update = function(time) {
		trees.update(time);
		cylinders.update(time);
		grass.update(time);
		sprouts.update(time);
		elusiveEntity.update(time);
	}
}