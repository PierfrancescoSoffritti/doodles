function Rain (stage) {
	var self = this;

	// theres a bug, canvas width and height are doubled :|||
	this.width = mBackgroundManager.canvas.width/2;
	this.height = mBackgroundManager.canvas.height/2;

	this.speed = this.height/500;
	this.length = 15;
	this.thickness = 5;

	this.numberOfParticles = 30;
	this.verticalDensity = 10;
	this.color = "#FFD19E"
	this.direction = 5;

	this.lastAvgAmp = 0;

	this.particles = new Array();
	
	var distanceX = this.width / this.numberOfParticles;
	var distanceY = this.height / this.verticalDensity;
	var currentX = 0;
	var currentY = 0;
	// add particles
	for(var i=0; i<(this.numberOfParticles*this.verticalDensity); i++) {
		if(i!= 0 && i % this.numberOfParticles == 0) {
			currentY -= distanceY;
			currentX = 0;
		}

		this.particles[i] = new createjs.Shape();
		this.particles[i].x = currentX;
		this.particles[i].y = currentY;

		this.particles[i].graphics.setStrokeStyle(this.thickness);
		this.particles[i].graphics.beginStroke(this.color);
		this.particles[i].graphics.moveTo(currentX, this.particles[i].y );
		this.particles[i].graphics.lineTo(currentX, this.particles[i].y+this.length);
		this.particles[i].graphics.endStroke();

		currentX += distanceX;
		
		stage.addChild(this.particles[i]);
	}
};

Rain.prototype.update = function() {
	var avgAmp = mSoundManager.getAverageAmplitude();
	if(avgAmp > 90 && this.lastAvgAmp < 80)
		this.direction = this.direction*-1;
	this.lastAvgAmp = avgAmp;

	this.particles.forEach((particle) => {
		particle.graphics.clear();

		// if off screen, respawen
		if(particle.y > this.height)
        	particle.y = -this.length;
        else
        	particle.y += this.speed / (avgAmp == 0 ? 4 : 1);        	

		particle.graphics.setStrokeStyle(this.thickness);
        particle.graphics.beginStroke(this.color);
        particle.graphics.moveTo(particle.x, particle.y);
        particle.graphics.lineTo(particle.x+this.direction, particle.y+this.length);
        particle.graphics.endStroke();
	});
};