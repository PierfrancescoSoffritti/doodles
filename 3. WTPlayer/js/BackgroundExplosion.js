function BackgroundExplosion (stage) {
	var self = this;

	this.stage = stage;

	// theres a bug, canvas width and height are doubled :|||
	this.width = mBackgroundManager.canvas.width/2;
	this.height = mBackgroundManager.canvas.height/2;

	this.explosionSpeed = this.height/20;
	this.circleSpeed = this.height/60;
	
	this.explosionThickness = 700;
	this.circleThickness = 50;

	this.maxRadiusExplosion = Math.max(this.width, this.height);
	this.maxRadiusExplosion += this.explosionThickness*2;

	this.maxRadiusCircle = 250;

	// [0] = red, [1] = green
	this.explosionColor = new Array("#FF4400", "#8BC34A");
	this.circleColor = "#43A047";

	this.lastAvgAmp = 0;

	// [0] = explosion
	this.explosion = new Array();
	this.circles = new Array();

	this.initCircles = function() {
		for(var i=0; i<1; i++) {
			
			var explosionCircle = new createjs.Shape();
			explosionCircle.x = this.width;
			explosionCircle.y = this.height;
			explosionCircle.radius = 0;
			explosionCircle.color = this.explosionColor[0];
			explosionCircle.exploding = false;

			var g = explosionCircle.graphics;
			g.setStrokeStyle(this.explosionThickness);
			g.beginStroke(explosionCircle.color);
			g.beginFill("rgba(0,0,0,0)");
			g.drawCircle(0, 0, explosionCircle.radius);
			g.endFill();
			this.stage.addChild(explosionCircle);

			this.explosion.push(explosionCircle);

			explosionCircle = new createjs.Shape();
			explosionCircle.x = this.width;
			explosionCircle.y = this.height;
			explosionCircle.radius = 0;
			explosionCircle.color = this.explosionColor[1];
			explosionCircle.exploding = false;

			g = explosionCircle.graphics;
			g.setStrokeStyle(this.explosionThickness);
			g.beginStroke(explosionCircle.color);
			g.beginFill("rgba(0,0,0,0)");
			g.drawCircle(0, 0, explosionCircle.radius);
			g.endFill();
			this.stage.addChild(explosionCircle);

			this.explosion.push(explosionCircle);
		}

		for(var i=0; i<2; i++) {
			
			var circle = new createjs.Shape();
			circle.x = this.width;
			circle.y = this.height;
			circle.radius = 0;
			circle.color = this.circleColor;
			circle.exploding = false;

			var g = circle.graphics;
			g.setStrokeStyle(this.circleThickness);
			g.beginStroke(circle.color);
			g.beginFill("rgba(0,0,0,0)");
			g.drawCircle(0, 0, circle.radius);
			g.endFill();
			this.stage.addChild(circle);

			this.circles.push(circle);
		}
	};

	this.initCircles();
};

BackgroundExplosion.prototype.update = function() {
	var self = this;

	// explosion
	var avgAmp = mSoundManager.getAverageAmplitude();
	if(avgAmp > 90 && this.lastAvgAmp < 80) {
		for(var i=0; i<this.explosion.length; i++) {
			if(!this.explosion[i].exploding) {
				this.explosion[i].exploding = true;
				break;
			}
		}
	}
	

	// animation
	this.explosion.forEach((circle) => { 
		if(circle.exploding) {			
			circle.graphics.clear();
			circle.radius += this.explosionSpeed;

			if(circle.radius >= this.maxRadiusExplosion) {
				circle.exploding = false;
				circle.radius = 0;
			}

			var g = circle.graphics;
			g.setStrokeStyle(this.explosionThickness);
			g.beginStroke(circle.color);
			g.beginFill("rgba(0,0,0,0)");
			g.drawCircle(0, 0, circle.radius);
			g.endFill();
		}
	});

	// circles
	if(avgAmp > 90) {
		for(var i=0; i<this.circles.length; i++) {
			if(!this.circles[i].exploding) {
				this.circles[i].exploding = true;
				break;
			}
		}
	}

	// animation
	this.circles.forEach((circle) => { 
		if(circle.exploding) {			
			circle.graphics.clear();
			circle.radius += this.circleSpeed;

			if(circle.radius >= this.maxRadiusCircle) {
				circle.exploding = false;
				circle.radius = 0;
				circle.alpha = 1;
			}

			if(circle.radius >= this.maxRadiusCircle/1.3)
				circle.alpha = 1 - circle.radius/this.maxRadiusCircle;

			var g = circle.graphics;
			g.setStrokeStyle(this.circleThickness);
			g.beginStroke(circle.color);
			g.beginFill("rgba(0,0,0,0)");
			g.drawCircle(0, 0, circle.radius);
			g.endFill();
		}
	});

	this.lastAvgAmp = avgAmp;
};