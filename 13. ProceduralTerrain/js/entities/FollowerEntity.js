function FollowerEntity(scene, player, collisionManager) {
	const self = this;

	this.minRadius = 40;
	this.maxRadius = 160;
	this.maxDistance = 180;
	this.animationTime = 300;

	this.height = 4;

	this.player;
	this.entities = [];
	this.collisionManager;

	this.update = function(time) {
		
		for(let i=0; i<this.entities.length; i++) {
			
			const entity = this.entities[i];

			if(!entity.animationInProgress) {
				const distance = Math.sqrt(Math.pow(this.player.position.x - entity.position.x, 2) + Math.pow(this.player.position.z - entity.position.z, 2));
				if(distance >= this.maxDistance)
					this.move(entity);
			}
		}
	}

	this.move = function(entity) {
		const angle = getRandom(0, Math.PI*2);
		const radius = getRandom(this.minRadius, this.maxRadius);	

		const x = this.player.position.x + radius * Math.cos(angle);
		const z = this.player.position.z + radius * Math.sin(angle);
		let y = this.collisionManager.getY(x, z) + this.height/2;
		
		if(y === null)
			y = 0;

		this.animateOut(entity, x, y, z, this.animateIn);
	}

	this.animateOut = function(entity, x, y, z, animateIn) {
		entity.animationInProgress = true;

		createjs.Tween
			.get(entity.position, {override:true})
			.to({y: - this.height }, this.animationTime, createjs.Ease.cubicInOut)
			.call(function() { 

				entity.position.x = x;
				entity.position.z = z;

				if(!animateIn) { 
					entity.position.y = y;
					entity.animationInProgress = false;
				} else {
					animateIn(entity, y);
				}
			});
	}

	this.animateIn = function(entity, y) {
		entity.animationInProgress = true;

		createjs.Tween
			.get(entity.position, {override:true})
			.to({y: y}, self.animationTime, createjs.Ease.cubicInOut)
			.call(function() {
				entity.animationInProgress = false;
			});
	}
}