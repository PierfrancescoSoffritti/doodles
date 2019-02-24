function Spheres(scene, cubeCamera) {
    // deformed sphere
    var icoGeometry = new THREE.IcosahedronGeometry(1, 6);
    var icoMaterial = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9, flatShading: false, 
        transparent: true, opacity: 1, side: THREE.DoubleSide, alphaTest: 0.5 });
    icoMaterial.envMap = cubeCamera.renderTarget.texture;

    var alphaMap = new THREE.TextureLoader().load('textures/noise.png');
    alphaMap.magFilter = THREE.NearestFilter;
    alphaMap.wrapT = THREE.RepeatWrapping;
    alphaMap.repeat.y = 10;
    alphaMap.repeat.x = 20;
    icoMaterial.alphaMap = alphaMap;

    var deformedSphere = new THREE.Mesh(icoGeometry, icoMaterial);
    scene.add(deformedSphere);

    // external sphere
    var externalSphere = deformedSphere.clone();
    externalSphere.geometry = new THREE.IcosahedronGeometry(1.01, 6);
    externalSphere.material = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9, flatShading: false, 
        transparent: true, opacity: 1, side: THREE.DoubleSide, alphaTest: 0.5 });
    
    var alphaMap = new THREE.TextureLoader().load('textures/stripe_vertical.png');
    alphaMap.magFilter = THREE.NearestFilter;
    alphaMap.wrapT = THREE.RepeatWrapping;
    alphaMap.repeat.y = 1;
    externalSphere.material.alphaMap = alphaMap;

    externalSphere.material.envMap = cubeCamera.renderTarget.texture;

    scene.add(externalSphere);

    var speed = 0.02;
    this.update = function(time) {

        externalSphere.material.alphaMap.offset.y = Math.sin(time*0.006)/4;

        var rotationSpeed = 0.008;
        var rotation = Math.sin(time * rotationSpeed)/2;
        externalSphere.rotation.x = rotation;
        externalSphere.rotation.z = rotation;

        deformedSphere.material.alphaMap.offset.y = time*0.003;

        deformedSphere.material.emissive.r = Math.max(0 , (Math.sin(time * speed)+1) * 0.2);
    }
}