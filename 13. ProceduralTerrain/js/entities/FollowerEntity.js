function FollowerEntity(scene, player, collisionManager) {
	this.minRadius;
	this.maxRadius;
	this.maxDistance;

	this.animationTimeIn;
	this.animationTimeOut;

	this.height;

	this.player;
	this.entities = [];
	this.collisionManager;

	this.forwardVector = new THREE.Vector3();

	this.update = function(time) {

		this.player.controls.getDirection(this.forwardVector);
		this.forwardVector.multiplyScalar(60);
		
		for(let i=0; i<this.entities.length; i++) {
			
			const entity = this.entities[i];

			if(!entity.animationInProgress) {
				
				// const distance = (this.forwardVector.clone().add(this.player.position)).distanceTo(entity.position)
				
				const distance = Math.sqrt(
					Math.pow( (this.player.position.x + this.forwardVector.x) - entity.position.x , 2)
					+
					Math.pow( (this.player.position.z + this.forwardVector.z) - entity.position.z , 2)
				);
			
				if(distance >= this.maxDistance) {
					this.move(entity);
				}
			}
		}
	}

	this.move = function(entity) {
		const angle = getRandom(0, Math.PI*2);
		const radius = getRandom(this.minRadius, this.maxRadius);

		// const x = this.player.position.x + radius * Math.cos(angle);
		// const z = this.player.position.z + radius * Math.sin(angle);
		const x = this.player.position.x + this.forwardVector.x + radius * Math.cos(angle);
		const z = this.player.position.z + this.forwardVector.z + radius * Math.sin(angle);
		let y = this.collisionManager.getY(x, z) + this.height/2;
		
		if(y === null)
			y = 0;

		this.animateOut(entity, x, y, z, this.animateIn);
	}

	this.animateOut = function(entity, x, y, z, animateIn) {
		entity.animationInProgress = true;

		const animationOutDuration = this.animationTimeOut;
		const animationInDuration = this.animationTimeIn;

		createjs.Tween
			.get(entity.position, {override:true})
			.to({y: - this.height/2 }, entity.animationTimeOut, createjs.Ease.cubicInOut)
			.call(function() { 

				entity.position.x = x;
				entity.position.z = z;

				if(!animateIn) { 
					entity.position.y = y;
					entity.animationInProgress = false;
				} else {
					animateIn(entity, y, animationInDuration);
				}
			});
	}

	this.animateIn = function(entity, y, animationInDuration) {
		entity.animationInProgress = true;
		
		createjs.Tween
			.get(entity.position, {override:true})
			.to({y: y}, entity.animationTimeIn, createjs.Ease.cubicInOut)
			.call(function() {
				entity.animationInProgress = false;
			});
	}
}