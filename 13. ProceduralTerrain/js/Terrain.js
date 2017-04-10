function Terrain(scene, cubecamera) {

    const mapGenerator = new MapGenerator(150, 5, .5, 2, 0, [0, 0], true);
    const map = mapGenerator.generateMap();

    const mesh = new TerrainMeshGenerator().generateTerrainMesh(map, .4, 15, 1).createMesh(cubecamera);
    mesh.scale.set(15, 15, 15)

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