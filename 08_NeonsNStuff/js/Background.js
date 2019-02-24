function Background(scene, cubeCamera) {
    var backgroundGeometry = new THREE.IcosahedronGeometry(20, 0);
    var backgroundMaterial = new THREE.MeshStandardMaterial({ color: "#000004", roughness: 1, metalness: .5, flatShading: true, side: THREE.BackSide });
    var background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    scene.add(background);

    var speed = 0.0002;
    
    this.update = function(time) {

        background.rotation.x += speed;
        background.rotation.y += speed;
        background.rotation.z += speed;
    }
}