function EntitiesSpawner(scene, player, collisionManager) {

	const cylinders = new Cylinders(scene, player, collisionManager);
	const grass = new Grass(scene, player, collisionManager);
	const trees = new Trees(scene, player, collisionManager);
	const sproutes = new Sproutes(scene, player, collisionManager);
	const elusiveEntity = new ElusiveEntity(scene, player, collisionManager);

	this.update = function(time) {
		trees.update(time);
		cylinders.update(time);
		grass.update(time);
		sproutes.update(time);
		elusiveEntity.update(time);
	}
}