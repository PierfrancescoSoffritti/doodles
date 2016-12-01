function GrassSceneSubject(scene) {

    var lines = new Array();
	
    var palette = [ 
        new THREE.LineBasicMaterial( { color: "#081C0A" } ),
        new THREE.LineBasicMaterial( { color: "#103712" } ),
        new THREE.LineBasicMaterial( { color: "#1B5E20" } ),
        new THREE.LineBasicMaterial( { color: "#4CAF50" } )
    ];

    // grass
    var distance = 0.08;
    var xQuantity = 80;
    var zQuantity = 50;
    for(var i=-xQuantity/2; i<xQuantity/2; i++) {
        var x = i*distance;
        for(var j=-zQuantity/2; j<zQuantity/2; j++) {
            var z = j*distance;
            var geometry = new THREE.Geometry();
            buildLine(geometry.vertices);

            var paletteIndx = Math.floor(getRandom(0, palette.length));
            var line = new THREE.Line(geometry, palette[paletteIndx]);
            line.position.x = x +getRandom(-distance, distance);
            line.position.z = z +getRandom(-distance, distance);

            lines.push(line);

            scene.add(line);
        }
    }

    // terrain
    var geometry = new THREE.BoxGeometry(distance*xQuantity+0.5, 1, distance*zQuantity+0.5);
    var material = new THREE.MeshBasicMaterial({ color: "#0A0606" });
    var cube = new THREE.Mesh(geometry, material);
    cube.position.y = -0.5;
    scene.add(cube);

    function buildLine(vertices) {
        vertices.push(new THREE.Vector3(0, 0, 0));
        vertices.push(new THREE.Vector3(0, getRandom(0.1, 0.4), 0));
        vertices[1].randomFactor = getRandom(0.06, 1);
    }


    this.update = function(time) {
        var x = (Math.sin(time*0.05)+1.5)/10;
        var z = Math.sin(time*0.1)/80;
        var deviation = Math.cos(time*0.01)/10;

        for(var i=0; i<lines.length; i++) {
            var geometry = lines[i].geometry;
            var vertices = geometry.vertices;

            vertices[1].x = (x +deviation) *vertices[1].randomFactor;
            vertices[1].z = z;

            geometry.verticesNeedUpdate = true;
        }
    }
}