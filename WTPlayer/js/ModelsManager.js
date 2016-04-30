function ModelsManager () {
	var self = this;

	// 1 = first level songs, 2 = second level songs, 3 = third level songs, 4 = other obj
	var rootColor = "#fff";
	var palette = ["#f44336"];
	var sizes = [60, 1, 5];

	this.model;

	// privileged
	this.init = function (callback) {
		loadModel();

		// done loading
		callback();
	};

	// private
	function loadModel () {
		var mModel = new SceneObject(sizes[0], palette[0]);
		mModel.parent = null;
		mModel.beahviour = new Beahviour(mModel);
		mModel.orbit = null;

		for(var i=0; i<10; i++) {
			var size = sizes[1] +Math.random()*8;
			var child = new SceneObject(size, palette[0]);
			child.showWireframe = false;
			child.parent = mModel;
			child.beahviour = new Beahviour(child);
			child.orbit = new Orbit(child);

			mModel.children.push(child);
		}

		self.model = mModel;
	};
};