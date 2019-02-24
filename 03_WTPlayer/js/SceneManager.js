function SceneManager () {
	var self = this;

	// screen info
	this.HEIGHT;
	this.WIDTH;
	this.aspectRatio;
	this.nearPlane;
	this.farPlane;

	this.mainScene;

	this.camera;
	this.renderer;

	// raycasting
	this.raycaster;
	this.mousePosition;
}

SceneManager.prototype.init = function(callback) {
	var self = this;

	// scene
	this.mainScene = new THREE.Scene();

	this.mainScene.fog = new THREE.Fog( 0xDAECFF, 2000, 50000 );

	// camera
	var canvas = document.getElementById("overlayCanvas");
	this.HEIGHT = canvas.height;
  	this.WIDTH = canvas.width;
  	this.aspectRatio = this.WIDTH / this.HEIGHT;
	thisfieldOfView = 60;
  	this.nearPlane = 1;
  	this.farPlane = 1000; 
	this.camera = new THREE.PerspectiveCamera(
		this.fieldOfView,
		this.aspectRatio,
		this.nearPlane,
		this.farPlane);

	this.camera.position.z = 500;

	// renderer
	var canvas = document.getElementById("overlayCanvas");
	this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); 
	//this.renderer.setPixelRatio( window.devicePixelRatio );
	this.renderer.setSize( this.WIDTH, this.HEIGHT );

	this.renderer.autoClear = false;
	this.renderer.gammaInput = true;
	this.renderer.gammaOutput = true;	
	this.renderer.shadowMap.enabled = true;
	this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	// raycasting
	this.raycaster = new THREE.Raycaster();
	this.mousePosition = new THREE.Vector2();

	setupLights();
	setupScene();

	// done
	callback();

	function setupLights() {
		var ambientLight = new THREE.AmbientLight( 0x404040 ); // soft white light
		self.mainScene.add(ambientLight);

		var light = new THREE.DirectionalLight( 0xaabbff, 0.3 );
		light.position.set(100, 0, 200);
		light.castShadow = true;
		self.mainScene.add(light);
	};

	function setupScene() {
		mModelsManager.model.addToScene(self.mainScene);
	};
};

SceneManager.prototype.update = function() {
	mModelsManager.model.update();

	this.renderer.clear();
	this.renderer.render(this.mainScene, this.camera);
};

SceneManager.prototype.onWindowResize = function(event) {
	var canvas = document.getElementById("overlayCanvas");
	this.HEIGHT = canvas.height;
  	this.WIDTH = canvas.width;
  	this.renderer.setSize(this.WIDTH, this.HEIGHT);
  	this.camera.updateProjectionMatrix();
};

SceneManager.prototype.onMouseDown = function(event) {
	this.mousePosition.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
	this.mousePosition.y = - (event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;

	this.raycaster.setFromCamera(this.mousePosition, this.camera);

	var mesh = [mModelsManager.model.baseMesh];
	var intersections;

	intersections = this.raycaster.intersectObjects(mesh);

	if(intersections.length > 0)
		mModelsManager.model.onClick();
};
