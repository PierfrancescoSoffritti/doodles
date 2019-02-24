function DoublePyramid(scene, cubeCamera) {
    var group = new THREE.Group();

    var size = .4;

    var pyramidGeometry = new THREE.CylinderGeometry( 0, size, size, 4, 1 );
    var material = new THREE.MeshStandardMaterial({ color: "#B71C1C", roughness: 0, flatShading: true });

    var top = new THREE.Mesh(pyramidGeometry, material);
    top.position.y = + size/2;
    group.add(top);

    var bottom = top.clone();
    bottom.rotation.x = Math.PI;
    bottom.position.y = - size/2
    group.add(bottom);

    // wireframe
    var wireMaterial = new THREE.MeshPhongMaterial({ color: "#4CAF50", flatShading: true, wireframe: true });
    var wBottom = bottom.clone();
    var wTop = top.clone();
    wBottom.material = wireMaterial;
    wTop.material = wireMaterial;
    wBottom.geometry = new THREE.CylinderGeometry( 0, size*1.1, size, 8, 1 );
    wTop.geometry = new THREE.CylinderGeometry( 0, size*1.1, size, 8, 1 );
    group.add(wBottom);
    group.add(wTop);

    scene.add(group);

    var speed = 0.02;

    this.update = function(time) {
        var scale = (Math.sin(time * speed)+10) / 10;
        group.scale.set(scale, scale, scale);

        group.rotation.y = Math.sin(time * 0.01) * Math.PI/2;

        material.emissive.r = (Math.sin(time * speed)+1) * 0.2;
    }
}