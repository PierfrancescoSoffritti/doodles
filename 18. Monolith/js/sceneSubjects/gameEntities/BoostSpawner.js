function BoostSpawner(scene, minHeight, maxHeight, minRad, maxRad) {
    const OBJECT_NAME = "boost_mesh"

    const minDelay = 1
    const maxDelay = 2

    const meshBoundingBox = 4

    const geometry = new THREE.BoxBufferGeometry( meshBoundingBox, meshBoundingBox, meshBoundingBox );
    const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
    const cube = new THREE.Mesh( geometry, material );
    cube.name = OBJECT_NAME;

    let currentCube = cube;

    let nextSpawnTime = getSpawnTimeDelay()

    this.update = function(time) {
        if(time > nextSpawnTime) {
            spawnCube()
            nextSpawnTime += getSpawnTimeDelay()
        }

        cube.rotation.x++
        cube.rotation.y++
        cube.rotation.z++;
    }

    this.checkCollision = function(position) {
        const distance = position.distanceTo( cube.position );
        if(distance < meshBoundingBox) {
            // eventBus.push(boost)
            scene.remove(cube)
        }
    }

    function getSpawnTimeDelay() {
        return getRandom(minDelay, maxDelay)
    }

    function spawnCube() {
        if( scene.getObjectByName(OBJECT_NAME) )
            return;
        else
            addMeshToScene(getRandom(minRad, maxRad), getRandom(0, Math.PI*2), getRandom(0, 1) < 0.5 ? minHeight : maxHeight)
    }

    function addMeshToScene(rad, angle, y) {
        const cartesianCoords = polarToCartesian(rad, angle)
        
        cube.position.x = cartesianCoords.x
        cube.position.z = cartesianCoords.y
        cube.position.y = y

        scene.add(cube)
    }
}