function SceneObject (size, color) {
	var self = this;

	this.size = size;
	var color = color;

	// must be instantiated in the constructor
	this.baseMesh;
	this.wireframeMesh;

	this.showWireframe = true;

	this.beahviour;
	this.orbit;

	this.parent;
	this.children = new Array();
	this.objects = new Array();

	this.initMesh = function() {
		/*
		var geometry = new THREE.SphereGeometry(size, 10, 8);
		var material = new THREE.MeshLambertMaterial( { color: color } );
		var mesh = new THREE.Mesh(geometry, material)
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.position.x = 0;
		mesh.position.y = 0;
		mesh.position.z = 0;

		return mesh;
		*/

		var geometry = new THREE.SphereGeometry(size, 6, 6);
		var material = new THREE.MeshLambertMaterial( { color: color } );
		this.baseMesh = new THREE.Mesh(geometry, material);
		this.baseMesh.castShadow = true;
		this.baseMesh.receiveShadow = true;
		this.baseMesh.position.x = 0;
		this.baseMesh.position.y = 0;
		this.baseMesh.position.z = 0;
		
		var geometryWireframe = new THREE.SphereGeometry(size*1.5, 6, 6);
		var materialWireframe = new THREE.MeshBasicMaterial( { color: 0x818181, wireframe: true} );
		this.wireframeMesh = new THREE.Mesh(geometryWireframe, materialWireframe);
		this.wireframeMesh.castShadow = true;
		this.wireframeMesh.receiveShadow = true;
		this.wireframeMesh.position.x = 0;
		this.wireframeMesh.position.y = 0;
		this.wireframeMesh.position.z = 0;
	}

	this.initMesh();
}

SceneObject.prototype.addToScene = function(scene) {
	scene.add(this.baseMesh);
	
	if(this.showWireframe)
		scene.add(this.wireframeMesh);

	this.children.forEach((child) => child.addToScene(scene));
}

SceneObject.prototype.onClick = function() {
	this.beahviour.behave();
}

SceneObject.prototype.update = function() {
	this.beahviour.update();

	if(this.orbit)
		this.orbit.update();

	this.children.forEach((child) => child.update());
}

