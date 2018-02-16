function EnemiesSpawner(scene, gameConstants) {
    const enemies = []
    this.enemies = enemies

    const delay = .4
    let lastEnemySpawnTime = 0

    const geometry = new THREE.BoxBufferGeometry( 2, 8, 4 )
    const material = new THREE.MeshStandardMaterial( {color: 0x00ff00} )
    const cube = new THREE.Mesh( geometry, material )
    scene.add( cube )
    
    const speed = 1.2

    let lastEleveationChangeTime = 0
    let changeElevationDelay = getRandom(2, 4)

    this.update = function(time) {
        updateSpawnerPosition(time)
        spawnEnemy(time)
        updateEnemies(time)
    }

    function updateSpawnerPosition(time) {
        const agle = time*speed
        const position = polarToCartesian(gameConstants.minRadius, agle)
        cube.position.x = position.x
        cube.position.z = position.y
        
        cube.rotation.y = -agle

        if(time > lastEleveationChangeTime + changeElevationDelay) {
            cube.position.y = cube.position.y === gameConstants.baseLevelHeight ? gameConstants.secondLevelHeight : gameConstants.baseLevelHeight
            
            lastEleveationChangeTime = time
            changeElevationDelay = getRandom(2, 4)
        }
    }

    function spawnEnemy(currentTime) {
        if(currentTime - lastEnemySpawnTime < delay)
            return
        
        enemies.push(new Enemy(scene, gameConstants, cube.position))
        lastEnemySpawnTime = currentTime
    }

    function updateEnemies(time) {
        for(let i=0; i<enemies.length; i++) {
            const expired = enemies[i].update(time)

            if(expired)
                enemies.splice(i, 1)
        }
    }
}