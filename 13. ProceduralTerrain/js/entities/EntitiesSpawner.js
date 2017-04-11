function EntitiesSpawner(scene, player, collisionManager) {

	const trees = new Trees(scene, player, collisionManager);
	const elusiveEntity = new ElusiveEntity(scene, player, collisionManager);

	this.update = function(time) {
		trees.update(time);
		elusiveEntity.update(time);
	}
}