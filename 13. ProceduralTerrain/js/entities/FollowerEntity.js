function FollowerEntity(entity, player, collisionManager) {

	const forwardVector = new THREE.Vector3();
	// const entities = entity.entities;

	this.update = function(time) {

		player.controls.getDirection(forwardVector);
		forwardVector.multiplyScalar(60);
		
		for(let i=0; i<entity.entities.length; i++) {
				
			const iEntity = entity.entities[i];

			if(!iEntity.animationInProgress) {
				
				// const distance = this.player.position).distanceTo(iEntity.position)
				
				const distance = Math.sqrt(
					Math.pow( (player.position.x + forwardVector.x) - iEntity.position.x , 2)
					+
					Math.pow( (player.position.z + forwardVector.z) - iEntity.position.z , 2)
				);
				
				if(distance >= entity.maxDistance) {
					move(iEntity, entity.minRadius, entity.maxRadius, entity.height);
				}
			}
		}
	}

	function move(iEntity, minRadius, maxRadius, height) {

		const angle = getRandom(0, Math.PI*2);
		const radius = getRandom(minRadius, maxRadius);

		// const x = this.player.position.x + radius * Math.cos(angle);
		// const z = this.player.position.z + radius * Math.sin(angle);
		const x = player.position.x + forwardVector.x + radius * Math.cos(angle);
		const z = player.position.z + forwardVector.z + radius * Math.sin(angle);
		
		let y = collisionManager.getY(x, z) + height/2;
		
		if(y === null)
			y = 0;

		animateOut(iEntity, x, y, z, height, animateIn);
	}

	function animateOut(iEntity, x, y, z, height, animateIn) {
		iEntity.animationInProgress = true;

		const animationOutDuration = iEntity.animationTimeOut;
		const animationInDuration = iEntity.animationTimeIn;

		createjs.Tween
			.get(iEntity.position, {override:true})
			.to({y: - height/2 }, animationOutDuration, createjs.Ease.cubicInOut)
			.call(function() { 

				iEntity.position.x = x;
				iEntity.position.z = z;

				if(!animateIn) { 
					iEntity.position.y = y;
					iEntity.animationInProgress = false;
				} else {
					animateIn(iEntity, y, animationInDuration);
				}
			});
	}

	function animateIn(iEntity, y, animationInDuration) {
		iEntity.animationInProgress = true;
		
		createjs.Tween
			.get(iEntity.position, {override:true})
			.to({y: y}, animationInDuration, createjs.Ease.cubicInOut)
			.call(function() {
				iEntity.animationInProgress = false;
			});
	}
}