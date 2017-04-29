function EntitiesSpawner(scene, player, collisionManager, terrainSize, cubeCamera) {

	const cylinders = new FollowerEntity(new Cylinders(scene), player, collisionManager);
	const grass = new FollowerEntity(new Grass(scene), player, collisionManager);
	const trees = new FollowerEntity(new Trees(scene), player, collisionManager);
	
	const sprouts = new Sprouts(scene, player, collisionManager, terrainSize);
	const mirrors = new Mirrors(scene, player, collisionManager, terrainSize, cubeCamera);
	const elusiveEntity = new ElusiveEntity(scene, player, collisionManager);

	this.update = function(time) {
		trees.update(time);
		cylinders.update(time);
		grass.update(time);
		
		sprouts.update(time);
		mirrors.update(time);
		elusiveEntity.update(time);
	}
}