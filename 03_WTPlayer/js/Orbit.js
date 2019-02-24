function Orbit (sceneObject) {
	var self = this;

	// precondition
	if(sceneObject == null)
		throw new Error("Orbit(sceneObject): sceneObject == null");

	this.sceneObject = sceneObject;

	var orbitRadiusFactor = 1 +Math.random()/2;
	this.orbitRadius = sceneObject.parent.size * orbitRadiusFactor;
	this.orbitCenter;

	this.orbitDeviation = [Math.random() +1, Math.random() +1, Math.random() +1];

	this.timeHorizontal = Math.floor( (Math.random() * (1500) ) + (-1500) );
	this.timeVertical = Math.floor( (Math.random() * (150) ) + (-150) );
	this.orbitSpeedHorizontal = Math.floor( (Math.random() * (5) ) + (-5) );
	this.orbitSpeedVertical = Math.floor( (Math.random() * (5) ) + (-5) );
};

Orbit.prototype.update = function() {
	var self = this;

	var avgAmp = mSoundManager.getAverageAmplitude()/100;
	var avgAmp = (avgAmp == 0 ? 0.2 : avgAmp);

	updateOrbitCenter();

	this.timeHorizontal += this.orbitSpeedHorizontal * avgAmp;
	var angleHorizontal = this.timeHorizontal * 0.01;

	this.timeVertical += this.orbitSpeedVertical * avgAmp;
	var angleVertical = this.timeVertical * 0.01;

	var radius = this.orbitRadius + avgAmp*2;

	this.sceneObject.baseMesh.position.set(
		( radius * this.orbitDeviation[0] ) * ( Math.sin(angleVertical) * Math.cos(angleHorizontal) ) + this.orbitCenter.x ,
		( radius * this.orbitDeviation[1] ) * ( Math.cos(angleVertical) ) + this.orbitCenter.y,
		( radius * this.orbitDeviation[2] ) * ( Math.sin(angleVertical) * Math.sin(angleHorizontal) ) + this.orbitCenter.z
	);

	function updateOrbitCenter() {
		self.orbitCenter = self.sceneObject.parent.baseMesh.position;
	};
	
};