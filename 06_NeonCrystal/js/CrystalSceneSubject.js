function CrystalSceneSubject(scene, cubeCamera) {
	
	var startVertices = new Array();

	// crystal
	var icoGeometry = new THREE.IcosahedronGeometry(1.5, 3);
    var icoMaterial = new THREE.MeshPhongMaterial({ color: "#000", shininess: 1, flatShading: true,
    	envMap: cubeCamera.renderTarget.texture, reflectivity: 0.1, combine: THREE.MixOperation });
    var mesh = new THREE.Mesh(icoGeometry, icoMaterial);
    scene.add(mesh);

    // wireframe
    var wireMaterial = new THREE.MeshPhongMaterial({ color: "#F44336", flatShading: true, wireframe: true });
    var wireGeometry = new THREE.IcosahedronGeometry(1.8, 3);
    var wireMesh = new THREE.Mesh(wireGeometry, wireMaterial);   
    scene.add(wireMesh);

    // geometry deformation
    for (var i=0; i<icoGeometry.vertices.length; i+=1) {
    	var scalar = 1 + Math.random()*0.8-0.5;
    	wireGeometry.vertices[i].multiplyScalar(scalar)
		icoGeometry.vertices[i].multiplyScalar(scalar)

		startVertices.push(wireGeometry.vertices[i].clone());
	}

	// particles
	var map = new THREE.TextureLoader().load("particle.png");
	var particleMaterial = new THREE.PointsMaterial({ map: map, color: "#fff", size: 0.04, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, alphaTest: 0.25 });
	var particles = new THREE.Points(wireGeometry, particleMaterial);
	scene.add(particles);

    this.update = function(time) {

    	wireMaterial.color.setHSL(Math.abs(Math.sin(time/100)), 0.9, 0.5 );
    	icoMaterial.color.setHSL(Math.abs(Math.sin(time/1000)), 0.9, 0.5 );

    	var sin = (Math.sin(time/100))/10;
    	for (var j=0; j<wireGeometry.vertices.length; j+=2) {
    		wireGeometry.vertices[j].copy(startVertices[j]);
			wireGeometry.vertices[j].multiplyScalar(1 + sin)
		}
		wireGeometry.verticesNeedUpdate = true;

		var sin = (Math.sin(time/100)/20)+0.95;
		mesh.scale.set(sin,sin,sin);

    	var rotationSpeed = 0.0002;
    	mesh.rotation.x += rotationSpeed;
    	mesh.rotation.y += rotationSpeed;
    	mesh.rotation.z += rotationSpeed;

    	wireMesh.rotation.x += rotationSpeed;
    	wireMesh.rotation.y += rotationSpeed;
    	wireMesh.rotation.z += rotationSpeed;

    	particles.rotation.x += rotationSpeed;
    	particles.rotation.y += rotationSpeed;
    	particles.rotation.z += rotationSpeed;
    }
}