function Torus(scene, cubeCamera) {
    var group = new THREE.Group();

    var radius = 2;

    var geometry = new THREE.TorusGeometry(radius, .05, 32, 64);
    var material = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9,  shading: THREE.SmoothShading  });

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
        temp.geometry = new THREE.TorusGeometry(radius-(i*0.20), .05, 32, 64);
        temp.material = material.clone();
        group.add(temp);
    }

    scene.add(group);

    var speed = 0.02;

    this.update = function(time) {

        for(var i=0; i<group.children.length; i++) {
            var child = group.children[i];

            // child.position.x = 1 * Math.sin( time * 0.001 - i *0.15 );
            // child.position.y = 1 * Math.sin( time * 0.003 - i *0.15 );

            // child.rotation.x = time * 0.01123 - Math.pow( i, 1.15 ) * 0.15;
            // child.rotation.y = time * 0.02 - Math.pow( i, 1.15 ) * 0.15;
            
            var rotSpeed = 0.008;
            var rot = Math.sin(time * rotSpeed)
            // child.rotation.x = rot;
            // child.rotation.y = rot; 
            // child.rotation.z = rot;
            // child.material.emissive.r = Math.max( 0, Math.sin( - time * 5 + i * 0.2 ) ) * 0.5;

            child.material.emissive.g = Math.max(0, (Math.sin(time * speed )+i*0.2) * 0.6);
            // child.material.emissive.g = Math.max( 0, Math.sin( - time * 0.01 + i * 0.2) ) * 0.5;
            // material.emissive.g = Math.pow( material.emissive.r * 2, 6 );

            child.rotation.x = Math.sin(time * rotSpeed - i*0.2) ;
            child.rotation.y = Math.sin(time * rotSpeed - i*0.2) ;
            // child.rotation.z += Math.sin(time * rotSpeed - i*0.25) ;
        }
    }
}