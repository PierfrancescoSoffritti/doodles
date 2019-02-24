function Rings(scene, cubeCamera) {
    var group = new THREE.Group();

    var radius = 2;

    var geometry = new THREE.TorusGeometry(radius, .055, 32, 128);
    var material = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9, flatShading: false });

    var envMap = new THREE.TextureLoader().load('textures/envMap.png');
    envMap.mapping = THREE.SphericalReflectionMapping;
    material.envMap = envMap;

    var emissiveMap = new THREE.TextureLoader().load('textures/stripe_horizontal.png');
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.repeat.x = 3;
    material.emissiveMap = emissiveMap;

    var mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    for(var i=1; i<4; i++) {
        var temp = mesh.clone();
        temp.geometry = new THREE.TorusGeometry(radius-(i*0.20), .055, 32, 128);
        temp.material = material.clone();
        group.add(temp);
    }

    scene.add(group);

    var speed = 0.02;

    this.update = function(time) {

        for(var i=0; i<group.children.length; i++) {
            var child = group.children[i];

            child.material.emissive.g = Math.max(0, (Math.sin(time * speed )+i*0.2) * 0.8);
            // child.material.emissive.r = Math.pow( child.material.emissive.g * 2, 6 ) / 140;

            var rotationSpeed = 0.008;
            var rotation = Math.sin(time * rotationSpeed - i*0.2);
            child.rotation.x = rotation;
            child.rotation.y = rotation;
        }
    }
}