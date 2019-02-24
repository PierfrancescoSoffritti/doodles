function SceneSubject(scene, cubeCamera) {

	var icoGeometry = new THREE.IcosahedronGeometry(1, 6);
    var material = new THREE.MeshPhongMaterial({ flatShading: false });

    material.envMap = cubeCamera.renderTarget.texture;
    material.reflectivity = .6;

    var colorMap = new THREE.TextureLoader().load('textures/Marble065_COL_1K.jpg');
    material.map = colorMap;

    var normalMap = new THREE.TextureLoader().load('textures/Marble065_NRM_1K.jpg');
    material.normalMap = normalMap;
    material.normalScale = new THREE.Vector2(0.5, 0.5);

    var specularMap = new THREE.TextureLoader().load('textures/SpecularMap.png');
    material.specularMap = specularMap;
    material.shininess = 400;

	var displacementMap = new THREE.TextureLoader().load('textures/Marble065_DISP_1K.jpg');
	material.displacementMap = displacementMap;
	material.displacementScale = .1;

    var mesh = new THREE.Mesh(icoGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

	var icoGeometry = new THREE.IcosahedronGeometry(.5, 3);
	var material = new THREE.MeshPhongMaterial({ color: "#F44336", shininess: 0});
	var ball = new THREE.Mesh(icoGeometry, material);
	ball.castShadow = true;
    ball.receiveShadow = true;
	ball.position.x = 2;
	ball.position.z = 1;
	scene.add(ball);

    this.update = function(time) {
    	ball.position.x = 2 * Math.sin(time *0.01);
    	ball.position.z = 2 * Math.cos(time *0.01)
    }
}