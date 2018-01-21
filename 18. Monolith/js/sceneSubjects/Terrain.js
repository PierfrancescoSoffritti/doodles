function Terrain(scene) {

    const mapGenerator = new MapGenerator(1, 1, .5, 2, 0, [0, 0], false);
    const map = mapGenerator.generateMap();

    const scale = 1;

    // terrain
    // const mesh = new TerrainMeshGenerator().generateTerrainMesh(map, .4, 15, 2).createMesh(cubecamera);
    const mesh = new TerrainMeshGenerator().generateTerrainMesh(map, .1, 2, 2).createMesh();
    mesh.scale.set(scale, scale, scale);
    scene.add(mesh);

    // terrain wireframe
    // const terrainWireframe = new THREE.LineSegments(
    //     new THREE.EdgesGeometry(mesh.geometry),
    //     new THREE.LineBasicMaterial()
    // );
    // mesh.add(terrainWireframe)

    this.size = mapGenerator.size * scale;
    this.terrain = mesh;

    this.update = function(time) {
        // terrainWireframe.material.color.setHSL(Math.sin(time * 0.1), 0.5, 0.5);
    }
}