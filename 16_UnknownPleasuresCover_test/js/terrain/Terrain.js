function Terrain() {

    const mapGenerator = new MapGenerator(150, 5, .5, 2, 0, [0, 0], true);
    const map = mapGenerator.generateMap();

    const scale = 1;

    const mesh = new TerrainMeshGenerator().generateTerrainMesh(map, .4, 15, 2).createMesh();
    mesh.scale.set(scale, scale, scale);

    const terrainWireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial()
    );
    mesh.add(terrainWireframe)

    this.size = mapGenerator.size * scale;
    this.mesh = mesh;

    this.update = function(time) {
        terrainWireframe.material.color.setHSL(Math.sin(time * 0.1), 0.5, 0.5);
    }
}