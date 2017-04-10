function Terrain(scene) {

    const mapGenerator = new MapGenerator(200, 5, .5, 2, 0, [0, 0]);
    const map = mapGenerator.generateMap();

    const mesh = new TerrainMeshGenerator().generateTerrainMesh(map, .4, 13, 1).createMesh();
    mesh.scale.set(8, 8, 8)

    scene.add(mesh)

    this.terrain = mesh;

    var wireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial()
    );

    mesh.add(wireframe)

    this.update = function(time) {
        wireframe.material.color.setHSL(Math.sin(time * 0.1), 0.5, 0.5 );
    }
}