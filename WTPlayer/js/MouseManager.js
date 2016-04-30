function MouseManager () {
	var self = this;
	this.position = { x: 0, y: 0};
};

MouseManager.prototype.onMouseMove = function(event) {
	this.position.x = event.clientX;	
	this.position.y = event.clientY;
};