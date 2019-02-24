function Cubes(scene) {

	var group = new THREE.Group();

    var size = .5;

    var geometry = new THREE.BoxGeometry( 1, 1, 1 );
    var material = new THREE.MeshStandardMaterial({ color: "#000", roughness: 1, metalness: .8, flatShading: false });

    var roughnessMap = new THREE.TextureLoader().load("textures/roughness.png")

    material.roughnessMap = roughnessMap;
    material.roughnessMap.anisotropy = 16;
	material.roughnessMap.repeat.y = 1;

    var subject = new THREE.Mesh(geometry, material);

    var wireframe = new THREE.LineSegments(
		new THREE.EdgesGeometry(geometry),
		new THREE.LineBasicMaterial()
	);

	subject.add(wireframe);

	var cols = new Array();
	for(var i=0; i<20; i+=2) {
		cols.push([]);
	}
    
    for(var x=-20; x<20; x+=2.5) {
    	for(var y=-20; y<20; y+=2) {
	    	for(var z=0; z<20; z+=2) {

	    		if(x === 0 && y === 0)
    				continue;

    			var tSubject = subject.clone();

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

    var show = true;

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
        	cols[i].forEach((subject) => { var pos = subject.position.z+speed; subject.position.z = pos < 6 ? pos : -20+6; subject.visible = show;});
        }
        // group.position.z = time * speed;

        wireframe.material.color.setHSL( Math.sin(time * speed), 0.5, 0.5 );


    }
}