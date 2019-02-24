function PointsEmitter (origin, target, stage) {
	var self = this;

	this.origin = origin;
	this.target = target;

	this.speed = 0.002;

	this.startColorAnimations = false;

	this.vector = { x: (target.x - origin.x), y: (target.y - origin.y) };

	this.numberOfParticles = 40;

	this.particles = new Array(this.numberOfParticles);
	
	// add particles
	for(var i=0; i<this.numberOfParticles; i++) {
		this.particles[i] = new createjs.Shape();
		this.particles[i].radius= 1 +Math.random()*8;
		this.particles[i].radius_steroids = this.particles[i].radius*5;
		this.particles[i].radius_use_steroids = false;
		this.particles[i].radiusMultiplier = Math.random()/20;
		this.particles[i].color="#6B0700";
		this.particles[i].colorIndex = 1;
		this.particles[i].colorIndexIncFactor = Math.random()*2;
		this.particles[i].x = origin.x;
		this.particles[i].y = origin.y;
		this.particles[i].graphics.beginFill(this.particles[i].color).drawCircle(0, 0, this.particles[i].radius);
		
		stage.addChild(this.particles[i]);
	}

	this.palette = new Array();
	// init palette
	// red
	this.palette.push(["#f44336", 0]);
	//pink
	this.palette.push(["#E91E63", 100]);
	// purple
	this.palette.push(["#9C27B0", 200]);
	// deep purple
	this.palette.push(["#673AB7", 300]);
	// indigo
	this.palette.push(["#3F51B5", 400]);
	// blue
	this.palette.push(["#2196F3", 500]);
	// light blue
	this.palette.push(["#03A9F4", 600]);
	// cyan
	this.palette.push(["#00BCD4", 700]);
	// teal
	this.palette.push(["#009688", 800]);
	// green
	this.palette.push(["#4CAF50", 900]);
	// light green
	this.palette.push(["#8BC34A", 1000]);
	// lime
	this.palette.push(["#CDDC39", 1100]);
	// yellow
	this.palette.push(["#FFEB3B", 1200]);
	// amber
	this.palette.push(["#FFC107", 1300]);
	// orange
	this.palette.push(["#FF9800", 1400]);
	// deep orange
	this.palette.push(["#FF5722", 1500]);
};

PointsEmitter.prototype.update = function() {
	// check mouse interaction
	this.particles.forEach((particle) => {
		dx = particle.x - mMouseManager.position.x;
		dy = particle.y - mMouseManager.position.y;

		var distance = Math.sqrt( Math.pow(dx, 2) + Math.pow(dy, 2) );

		if(distance<70)
			particle.radius_use_steroids = true;
		else
			particle.radius_use_steroids = false;
	});

	var avgAmp = mSoundManager.getAverageAmplitude();
	var musicSpeed = avgAmp;
	musicSpeed /= 10;
	musicSpeed += 0.3;
	this.particles.forEach((particle) => {
		// movement
		particle.x += (this.vector.x * Math.random()*1.5)* (this.speed * musicSpeed);
		particle.y += (this.vector.y * Math.random()*1.5) * (this.speed * musicSpeed);

		// position relative to center
		var xPos = (particle.x-mBackgroundManager.canvas.width/2);
  		var yPos = (particle.y-mBackgroundManager.canvas.height/2);

  		// respawn
		if(Math.abs(xPos) >= (mBackgroundManager.canvas.width/2)-150 && Math.abs(yPos) >= (mBackgroundManager.canvas.height/2)-150) {
			particle.radius_use_steroids = false;
			particle.x = this.origin.x;
			particle.y = this.origin.y;
		}

		// color animations starts only after a certain amplitude 
		if(avgAmp > 80)
			this.startColorAnimations = true;
		if(this.startColorAnimations) {
			// color, loops on the palette
			for(var i=0; i<this.palette.length-1; i++) {
				var color = this.palette[i];
				var nextColor = this.palette[i+1];
				if(particle.colorIndex >= color[1] && particle.colorIndex <= nextColor[1]) {
					particle.color = color[0];
				}
			}
			// if color index is out of bound, restart
			particle.colorIndex += particle.colorIndexIncFactor * avgAmp/25;
			if(particle.colorIndex >= this.palette[this.palette.length-1][1])
				particle.colorIndex = 0;
		}

	});
};