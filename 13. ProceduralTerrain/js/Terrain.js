function Terrain(scene) {

    const mapGenerator = new MapGenerator(200, 5, .5, 2, 0, [0, 0]);
    const map = mapGenerator.generateMap();

    const mesh = new TerrainMeshGenerator().generateTerrainMesh(map, .4, 13, 1).createMesh();

    scene.add(mesh)

    this.terrain = mesh;

 //    var geometry = new THREE.PlaneGeometry( 241, 241, 32 );
	// var material = new THREE.MeshBasicMaterial( {color: "#6666FF", side: THREE.DoubleSide} );
	// var plane = new THREE.Mesh( geometry, material );
	// plane.rotation.x = -Math.PI/2
	// plane.position.y = .01;
	// scene.add( plane );

    this.update = function(time) {
    }
}