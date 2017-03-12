function Sphere(scene, cubeCamera) {
    // deformed sphere
    var icoGeometry = new THREE.IcosahedronGeometry(1.5, 2);
    // var icoMaterial = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9,  shading: THREE.SmoothShading, 
    //     transparent: true, opacity: 1, side: THREE.DoubleSide, alphaTest: 0.5 });
    var icoMaterial = new THREE.MeshBasicMaterial({ color: "#000", wireframe: false });

    // icoMaterial.envMap = cubeCamera.renderTarget.texture;

    var deformedSphere = new THREE.Mesh(icoGeometry, icoMaterial);
    scene.add(deformedSphere);

    var envMap = new THREE.TextureLoader().load('textures/env2.png');
    envMap.mapping = THREE.SphericalReflectionMapping;

    var eyeTexture_red = new THREE.TextureLoader().load('textures/eye_red.jpg');
    eyeTexture_red.mapping = THREE.SphericalReflectionMapping;

    var textures = [eyeTexture_red]

    var eyeGeometry = new THREE.IcosahedronGeometry(0.24, 3);
        
    // modify UVs to accommodate MatCap texture
    var faceVertexUvs = eyeGeometry.faceVertexUvs[ 0 ];
    for ( i = 0; i < faceVertexUvs.length; i ++ ) {

        var uvs = faceVertexUvs[ i ];
        var face = eyeGeometry.faces[ i ];

        for ( var j = 0; j < 3; j ++ ) {

            uvs[ j ].x = face.vertexNormals[ j ].x * 0.5 + 0.5;
            uvs[ j ].y = face.vertexNormals[ j ].y * 0.5 + 0.5;

        }
    }

    var eyes = new Array();
    var randFactors = new Array();

    // geometry deformation
    for (var i=0; i<icoGeometry.vertices.length; i++) {
        var vertex = icoGeometry.vertices[i];
        
        var tSphere = deformedSphere.clone();

        tSphere.geometry = eyeGeometry;

        tSphere.material = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9,  shading: THREE.SmoothShading, opacity: 1, alphaTest: 0.5 });

        tSphere.material.envMap = envMap;
        tSphere.material.map = textures[ Math.floor(getRandom(0, textures.length)) ];

        tSphere.position.set(vertex.x, vertex.y, vertex.z);
        scene.add(tSphere);

        eyes.push(tSphere);
        randFactors.push({x: getRandom(-0.4, 0.4), y: getRandom(-0.4, 0.4)});
    }

    var speed = 0.02;
    var follow = false;
    this.update = function(time, mousePosition) {

        if(!mousePosition.disabled)
            follow = true;
        else
            follow = false;

        var rotationSpeed = 0.008;
        var rotation = Math.sin(time * rotationSpeed)/2;

        for(var i=0; i<eyes.length; i++) {            
            if(follow) {
                eyes[i].rotation.x += (( mousePosition.y/1000 ) - eyes[i].rotation.x) * 0.06
                eyes[i].rotation.y += (( mousePosition.x/1000 ) - eyes[i].rotation.y) * 0.06
            } else {
                var x = Math.sin(time* randFactors[i].x*speed);
                var y = Math.sin(time* randFactors[i].y*speed)
                eyes[i].rotation.x += (( x ) - eyes[i].rotation.x) * 0.006
                eyes[i].rotation.y +=  (( y ) - eyes[i].rotation.y) * 0.006
            }
        }
    }
}