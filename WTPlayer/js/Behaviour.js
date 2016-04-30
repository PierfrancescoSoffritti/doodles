function Beahviour (sceneObject) {
	var self = this;

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

	this.startColorAnimations = false;
	this.colorIndex = 1;
	this.colorIndexIncFactor = Math.random()*2;

	// precondition
	if(sceneObject == null)
		throw new Error("Beahviour(sceneObject): sceneObject == null");

	this.sceneObject = sceneObject;

	this.scale = new THREE.Vector3( 0, 0, 0 );
	this.scale.x = this.sceneObject.baseMesh.scale.x;
	this.scale.y = this.sceneObject.baseMesh.scale.y;
	this.scale.z = this.sceneObject.baseMesh.scale.z;
};

Beahviour.prototype.behave = function() {
	mSoundManager.playPause();
};

Beahviour.prototype.update = function() {
	var self = this;
	var avgAmp = mSoundManager.getAverageAmplitude();
	var avgAmpReduced = avgAmp/200;
	var avgAmpReduced = avgAmpReduced - avgAmpReduced/1.9;

	var rot = avgAmpReduced == 0 ? 0.01 : avgAmpReduced;
	this.sceneObject.wireframeMesh.rotation.y += 0.1 * rot;
	this.sceneObject.wireframeMesh.rotation.z += 0.06 * rot;
	this.sceneObject.wireframeMesh.rotation.x += 0.09 * rot;
		
	// pulsation
	this.sceneObject.baseMesh.scale.x = this.scale.x + avgAmpReduced;
	this.sceneObject.baseMesh.scale.y = this.scale.y + avgAmpReduced;
	this.sceneObject.baseMesh.scale.z = this.scale.z + avgAmpReduced;

	// color animations starts only after a certain amplitude 
	if(avgAmp > 80)
		this.startColorAnimations = true;
	if(this.startColorAnimations) {
		// color, loops on the palette
		for(var i=0; i<this.palette.length-1; i++) {
			var color = this.palette[i];
			var nextColor = this.palette[i+1];
			if(this.colorIndex >= color[1] && this.colorIndex <= nextColor[1]) {
				this.sceneObject.baseMesh.material.color.set(color[0]);
			}
		}
		// if color index is out of bound, restart
		this.colorIndex += this.colorIndexIncFactor * avgAmp/25;
		if(this.colorIndex >= this.palette[this.palette.length-1][1])
			this.colorIndex = 0;

	}
};