function EntitiesSpawner(scene, player, collisionManager) {

	const cylinders = new Cylinders(scene, player, collisionManager);
	const grass = new Grass(scene, player, collisionManager);
	const elusiveEntity = new ElusiveEntity(scene, player, collisionManager);

	this.update = function(time) {
		cylinders.update(time);
		grass.update(time);
		elusiveEntity.update(time);
	}
}