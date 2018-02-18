function EnemiesSpawner(scene, gameConstants) {
    const enemies = []

    const delay = .4
    let lastEnemySpawnTime = 0

    const spawnerGeometry = new THREE.BoxBufferGeometry( 2, 8, 4 )
    const spawnerMaterial = new THREE.MeshStandardMaterial( {color: 0x00ff00} )
    const spawnerMesh = new THREE.Mesh( spawnerGeometry, spawnerMaterial )
    scene.add( spawnerMesh )
    
    spawnerMesh.position.y = gameConstants.baseLevelHeight    

    const speed = 1.2

    let lastEleveationChangeTime = 0
    let changeElevationDelay = 0

    this.enemies = enemies

    this.update = function(time) {
        updateSpawnerPolarPosition(time)
        updateSpawnerHeight(time)
        spawnEnemy(time)
        updateEnemies(time)
    }

    function updateSpawnerPolarPosition(time) {
        const agle = time*speed
        const position = polarToCartesian(gameConstants.minRadius, agle)
        spawnerMesh.position.x = position.x
        spawnerMesh.position.z = position.y
        
        spawnerMesh.rotation.y = -agle
    }

    function updateSpawnerHeight(time) {
        if(time <= lastEleveationChangeTime + changeElevationDelay)
            return

        spawnerMesh.position.y = getRandom(0, 1) > 0.5 ? gameConstants.secondLevelHeight : gameConstants.baseLevelHeight
        
        lastEleveationChangeTime = time
        changeElevationDelay = getRandom(2, 4)
    }

    function spawnEnemy(currentTime) {
        if(currentTime - lastEnemySpawnTime < delay)
            return
        
        enemies.push(new Enemy(scene, gameConstants, spawnerMesh.position))
        lastEnemySpawnTime = currentTime
    }

    function updateEnemies(time) {
        for(let i=0; i<enemies.length; i++) {
            const expired = enemies[i].update(time)

            if(expired)
                removeEnemy(i)
        }
    }

    function removeEnemy(i) {
        enemies.splice(i, 1)
        eventBus.post(decreaseScore)
    }
}