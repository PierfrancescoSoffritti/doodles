function EntitiesSpawner(scene, player, collisionManager) {

	const cylinders = new Cylinders(scene, player, collisionManager);
	const grass = new Grass(scene, player, collisionManager);
	const trees = new Trees(scene, player, collisionManager);
	const elusiveEntity = new ElusiveEntity(scene, player, collisionManager);

	let isMoving = false;

	this.update = function(time) {
		isMoving = isMoving || trees.update(time);
		isMoving = isMoving || cylinders.update(time);
		isMoving = isMoving || grass.update(time);
		elusiveEntity.update(time);

		// if(isMoving)
		// 	eventBus.post(playGrowingTreeSound);

		isMoving = false;
	}
}