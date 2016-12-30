function SceneSubject(scene, cubeCamera) {
    var icoGeometry = new THREE.IcosahedronGeometry(1, 6);
    var icoMaterial = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9,  shading: THREE.SmoothShading, 
        transparent: true, opacity: 1, side: THREE.DoubleSide, alphaTest: 0.5 });
    icoMaterial.envMap = cubeCamera.renderTarget.texture;

    var alphaMap = new THREE.TextureLoader().load('textures/noise.png');
    alphaMap.magFilter = THREE.NearestFilter;
    alphaMap.wrapT = THREE.RepeatWrapping;
    alphaMap.repeat.y = 10;
    alphaMap.repeat.x = 20;
    icoMaterial.alphaMap = alphaMap;

    var emissiveMap = new THREE.TextureLoader().load('textures/stripe_vertical.png');
    emissiveMap.magFilter = THREE.NearestFilter;
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.repeat.y = 10;
    // icoMaterial.emissiveMap = emissiveMap;

    var icoMesh = new THREE.Mesh(icoGeometry, icoMaterial);
    scene.add(icoMesh);

    var backgroundGeometry = new THREE.IcosahedronGeometry(20, 0);
    var backgroundMaterial = new THREE.MeshStandardMaterial({ color: "#00000A", roughness: 1, metalness: .5, shading: THREE.FlatShading, side: THREE.BackSide });
    var background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    scene.add(background);

    var extraSphere = icoMesh.clone();
    extraSphere.material = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9,  shading: THREE.SmoothShading, 
        transparent: true, opacity: 1, side: THREE.DoubleSide, alphaTest: 0.5 });
    var alphaMap = new THREE.TextureLoader().load('textures/stripe_vertical.png');
    alphaMap.magFilter = THREE.NearestFilter;
    alphaMap.wrapT = THREE.RepeatWrapping;
    alphaMap.repeat.y = 1;
    extraSphere.material.alphaMap = alphaMap
    extraSphere.material.envMap = cubeCamera.renderTarget.texture
    scene.add(extraSphere)

    var speed = 0.02;
    var backgroundSpeed = 0.0008;
    this.update = function(time) {

        background.rotation.x += backgroundSpeed;
        background.rotation.y += backgroundSpeed;
        background.rotation.z += backgroundSpeed;

        extraSphere.material.alphaMap.offset.y = Math.sin(time*0.006)/4;

        icoMesh.material.alphaMap.offset.y = time*0.003;

        icoMaterial.emissive.r = Math.max(0 , (Math.sin(time * speed)+1) * 0.2);
    }
}