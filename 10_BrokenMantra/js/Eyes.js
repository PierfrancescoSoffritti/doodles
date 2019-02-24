function Eyes(scene) {

	var group = new THREE.Group();

    var show = false;

    var size = .5;

    var icoGeometry = new THREE.IcosahedronGeometry(1.5, 2);
    var icoMaterial = new THREE.MeshBasicMaterial({ color: "#000", wireframe: false });

    var baseSphere = new THREE.Mesh(icoGeometry, icoMaterial);
    // scene.add(baseSphere);

    var envMap = new THREE.TextureLoader().load('textures/env2.png');
    envMap.mapping = THREE.SphericalReflectionMapping;

    var eyeTexture_red = new THREE.TextureLoader().load('textures/eye_red.jpg');
    eyeTexture_red.mapping = THREE.SphericalReflectionMapping;

    var eyeGeometry = new THREE.IcosahedronGeometry(0.5, 2);
        
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

    var wireframe = new THREE.LineSegments(
		new THREE.EdgesGeometry(eyeGeometry),
		new THREE.LineBasicMaterial()
	);

	// eye.add(wireframe);

	var cols = new Array();
	for(var i=0; i<20; i+=2) {
		cols.push([]);
	}
    
    for(var x=-20; x<20; x+=2.5) {
    	for(var y=-20; y<20; y+=2) {
	    	for(var z=0; z<20; z+=2) {

	    		if(x === 0 && y === 0)
    				continue;

    			var tSubject = eye.clone();

    			tSubject.position.set(x, y, -z);
    			group.add(tSubject);

    			cols[z/2].push(tSubject);
    		}
    	}
    }

    // var bottom = subject.clone();
    // bottom.rotation.x = Math.PI;
    // bottom.position.y = - size/2
    // group.add(bottom);

    scene.add(group);

    var speed = 0.01;

    this.show = function(s) {
        show = s;

        for(var i=0; i<cols.length; i++) {
            cols[i].forEach((subject) => subject.visible = show );
        }
    }

    this.update = function(time, mousePosition) {
        if(!show)
            return;

        // geometry.vertices[0].y = Math.sin(time*speed) 
        // geometry.verticesNeedUpdate = true;
        
        for(var i=0; i<cols.length; i++) {
        	cols[i].forEach((subject) => { var pos = subject.position.z+speed; subject.position.z = pos < 6 ? pos : -20+6; subject.lookAt(new THREE.Vector3(0, 0, 6)); subject.visible = show; });
        }
        // group.position.z = time * speed;

        wireframe.material.color.setHSL( Math.sin(time * speed), 0.5, 0.5 );


    }
}