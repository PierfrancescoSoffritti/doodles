function Sphere(scene) {
    // deformed sphere
    var icoGeometry = new THREE.IcosahedronGeometry(1.5, 2);
    var icoMaterial = new THREE.MeshBasicMaterial({ color: "#000", wireframe: false });

    var baseSphere = new THREE.Mesh(icoGeometry, icoMaterial);
    scene.add(baseSphere);

    var envMap = new THREE.TextureLoader().load('textures/env2.png');
    envMap.mapping = THREE.SphericalReflectionMapping;

    var eyeTexture_red = new THREE.TextureLoader().load('textures/eye_red.jpg');
    eyeTexture_red.mapping = THREE.SphericalReflectionMapping;

    var eyeGeometry = new THREE.IcosahedronGeometry(0.24, 3);
        
    // modify UVs to accommodate texture
    var faceVertexUvs = eyeGeometry.faceVertexUvs[0];
    for (i=0; i<faceVertexUvs.length; i++) {

        var uvs = faceVertexUvs[i];
        var face = eyeGeometry.faces[i];

        for (var j=0; j<3; j++) {

            uvs[j].x = face.vertexNormals[j].x * 0.5 + 0.5;
            uvs[j].y = face.vertexNormals[j].y * 0.5 + 0.5;

        }
    }

    var eyeMaterial = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9, flatShading: false, opacity: 1 });
	eyeMaterial.envMap = envMap;
    eyeMaterial.map = eyeTexture_red;

    var eye = baseSphere.clone();

    eye.geometry = eyeGeometry;
    eye.material = eyeMaterial;

    var eyes = new Array();
    var randFactors = new Array();

    // add an eye on each vertex
    for (var i=0; i<icoGeometry.vertices.length; i++) {
        var vertex = icoGeometry.vertices[i];
        
        if(vertex.z < 0)
        	continue;
        
        var tEye = eye.clone();

        tEye.position.set(vertex.x, vertex.y, vertex.z);
        scene.add(tEye);

        eyes.push(tEye);
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
                // var x = mousePosition.x / 1000;
                // var y = mousePosition.y / 1000;
                // var distance = Math.sqrt( Math.pow(eyes[i].position.x - x, 2) + Math.pow(eyes[i].position.y - y, 2) );
                // eyes[i].rotation.x += (( mousePosition.y/1000 * distance ) - eyes[i].rotation.x) * 0.06
                // eyes[i].rotation.y += (( mousePosition.x/1000 * distance ) - eyes[i].rotation.y) * 0.06
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