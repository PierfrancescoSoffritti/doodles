function BackgroundManager () {
	var self = this;

	// [0] = light purple, [1] = dark purple
	// [2] = light blue, [3] = dark blue
	this.palette = ["#4D5B7E", "#2B385C", "#286F8D", "#0A5676"];
	this.backgroundColor = "#FF8004";

	this.stage;
	this.canvas = document.getElementById("baseCanvas");

	this.circles = new Array();

	this.emitters = new Array(4);
	this.rain;
	this.backgroundExplosion;
}

BackgroundManager.prototype.init = function(callback) {
	self = this;

	this.stage = new createjs.Stage("baseCanvas");

	this.canvas.style.backgroundColor =  this.backgroundColor;

	this.backgroundExplosion = new BackgroundExplosion(this.stage);
	this.rain = new Rain(this.stage);

	var offsetX = this.canvas.width/7;
	var offsetY = this.canvas.height/7;

	var originX = this.canvas.width/2;
	var originY = this.canvas.height/2;

	// top right
	var target = {x: offsetX, y: offsetY };
	var origin = {x: originX -100, y: originY -100 };
	this.emitters.push(new PointsEmitter(origin, target, this.stage));

	// bottom right
	target = {x: offsetX, y: this.canvas.height - offsetY };
	origin = {x: originX -100, y: originY +100 };
	this.emitters.push(new PointsEmitter(origin, target, this.stage));

	// top left
	target = {x: this.canvas.width - offsetX , y: offsetY };
	origin = {x: originX +100, y: originY-100 };
	this.emitters.push(new PointsEmitter(origin, target, this.stage));

	// bottom left
	target = {x: this.canvas.width - offsetX, y: this.canvas.height - offsetY };
	origin = {x: originX +100, y: originY +100 };
	this.emitters.push(new PointsEmitter(origin, target, this.stage));

	setupCircles();

	// done loading
	callback();

	function setupCircles() {
		// top left
		var circleTopLeft_big = new createjs.Shape();
		circleTopLeft_big.x = 0;
		circleTopLeft_big.y = 0;
		circleTopLeft_big.radius = 180;
		circleTopLeft_big.color = self.palette[0];
		circleTopLeft_big.radiusMultiplier = 1;
		circleTopLeft_big.graphics.beginFill(circleTopLeft_big.color).drawCircle(0, 0, circleTopLeft_big.radius);
		self.stage.addChild(circleTopLeft_big);

		var circleTopLeft_small = new createjs.Shape();
		circleTopLeft_small.x = 0;
		circleTopLeft_small.y = 0;
		circleTopLeft_small.radius = 100;
		circleTopLeft_small.color = self.palette[1];
		circleTopLeft_small.radiusMultiplier = 1.3;
		circleTopLeft_small.graphics.beginFill(circleTopLeft_small.color).drawCircle(0, 0, circleTopLeft_small.radius);
		self.stage.addChild(circleTopLeft_small);

		// bottom left
		var circleBottomLeft_big = new createjs.Shape();
		circleBottomLeft_big.x = 0;
		circleBottomLeft_big.y = self.canvas.height;
		circleBottomLeft_big.radius = 80;
		circleBottomLeft_big.color = self.palette[2];
		circleBottomLeft_big.radiusMultiplier = 1.5;
		circleBottomLeft_big.graphics.beginFill(circleBottomLeft_big.color).drawCircle(0, 0, circleBottomLeft_big.radius);
		self.stage.addChild(circleBottomLeft_big);

		// top right
		var circleTopRight_big = new createjs.Shape();
		circleTopRight_big.x = self.canvas.width;
		circleTopRight_big.y = 0;
		circleTopRight_big.radius = 200;
		circleTopRight_big.color = self.palette[2];
		circleTopRight_big.radiusMultiplier = 1;
		circleTopRight_big.graphics.beginFill(circleTopRight_big.color).drawCircle(0, 0, circleTopRight_big.radius);
		self.stage.addChild(circleTopRight_big);

		var circleTopRight_small = new createjs.Shape();
		circleTopRight_small.x = self.canvas.width;
		circleTopRight_small.y = 0;
		circleTopRight_small.radius = 60;
		circleTopRight_small.color = self.palette[3];
		circleTopRight_small.radiusMultiplier = 2;
		circleTopRight_small.graphics.beginFill(circleTopRight_small.color).drawCircle(0, 0, circleTopRight_small.radius);
		self.stage.addChild(circleTopRight_small);

		// bottom right
		var circleBottomRight_big = new createjs.Shape();
		circleBottomRight_big.x = self.canvas.width;
		circleBottomRight_big.y = self.canvas.height;
		circleBottomRight_big.radius = 120;
		circleBottomRight_big.color = self.palette[0];
		circleBottomRight_big.radiusMultiplier = 1;
		circleBottomRight_big.graphics.beginFill(circleBottomRight_big.color).drawCircle(0, 0, circleBottomRight_big.radius);
		self.stage.addChild(circleBottomRight_big);

		var circleBottomRight_small = new createjs.Shape();
		circleBottomRight_small.x = self.canvas.width;
		circleBottomRight_small.y = self.canvas.height;
		circleBottomRight_small.radius = 60;
		circleBottomRight_small.color = self.palette[1];
		circleBottomRight_small.radiusMultiplier = 0.6;
		circleBottomRight_small.graphics.beginFill(circleBottomRight_small.color).drawCircle(0, 0, circleBottomRight_small.radius);
		self.stage.addChild(circleBottomRight_small);

		self.circles.push(circleTopLeft_big);
		self.circles.push(circleTopLeft_small);

		self.circles.push(circleBottomLeft_big);

		self.circles.push(circleTopRight_big);
		self.circles.push(circleTopRight_small);

		self.circles.push(circleBottomRight_big);
		self.circles.push(circleBottomRight_small);
	}
}

BackgroundManager.prototype.update = function() {
	var avgAmp = mSoundManager.getAverageAmplitude();

	this.backgroundExplosion.update();
	this.rain.update();
	
	// update circles
	this.circles.forEach((circle) => updateCircle(circle, avgAmp));

	// update emitters
	this.emitters.forEach((emitter) => {
		emitter.particles.forEach((particle) => updateCircle(particle, avgAmp));
		emitter.update();
	} );

	this.stage.update();

	function updateCircle(circle, radiusScale) {
		circle.graphics.clear();

		if(circle.radius_use_steroids)
			circle.graphics.beginFill(circle.color).drawCircle(0, 0, circle.radius_steroids + (radiusScale*circle.radiusMultiplier));
		else
			circle.graphics.beginFill(circle.color).drawCircle(0, 0, circle.radius + (radiusScale*circle.radiusMultiplier));
	}
};