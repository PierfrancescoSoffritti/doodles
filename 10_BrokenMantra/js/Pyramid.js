function Pyramid(scene) {

	var group = new THREE.Group();

    var size = 1.5;

    var pyramidGeometry = new THREE.CylinderGeometry( 0, size, size*1.5, 4, 1 );
    var material = new THREE.MeshStandardMaterial({ color: "#000", roughness: 1, metalness: .8, flatShading: false });

    var roughnessMap = new THREE.TextureLoader().load("textures/roughness.png")

    material.roughnessMap = roughnessMap;
    material.roughnessMap.anisotropy = 16;
	material.roughnessMap.repeat.y = 1;

    var top = new THREE.Mesh(pyramidGeometry, material);
    top.position.y = 0;
    group.add(top);

    // var bottom = top.clone();
    // bottom.rotation.x = Math.PI;
    // bottom.position.y = - size/2
    // group.add(bottom);
     
    var wireframe = new THREE.LineSegments(
		new THREE.EdgesGeometry(pyramidGeometry),
		new THREE.LineBasicMaterial()
	);

	group.add(wireframe);

    scene.add(group);

    var speed = 0.01;

    this.update = function(time, mousePosition) {
        group.rotation.y = time * speed;

        // pyramidGeometry.vertices[0].y = Math.sin(time*speed) 
        // pyramidGeometry.verticesNeedUpdate = true;

        wireframe.material.color.setHSL( Math.sin(time * speed), 0.5, 0.5 );
    }

    this.moveTo = function (x, y, z) {
        group.position.set(x, y, z);
    }

    this.show = function(show) {
        group.visible = show;
    }
}