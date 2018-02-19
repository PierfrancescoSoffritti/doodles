function EnemiesSpawner(scene, gameConstants) {
    const enemies = []

    const spawnerGeometry = new THREE.BoxBufferGeometry( 2, 8, 4 )
    const spawnerMaterial = new THREE.MeshBasicMaterial( {color: 0x666600} )
    const spawnerMesh = new THREE.Mesh( spawnerGeometry, spawnerMaterial )
    scene.add( spawnerMesh )
    
    spawnerMesh.position.y = gameConstants.baseLevelHeight    

    const speed = .006
    const acceletationMax = 1
    const accelerationIncreaseStep = 0.02
    const accelerationDecreaseStep = 0.009
    const angleAccelerator = new Accelerator(speed, acceletationMax, accelerationIncreaseStep, accelerationDecreaseStep)

    let currentAngle = 0
    let angleDirection = 1
    let lastDirectionChangeTime = 0
    let changeDirectionDelay = 0

    let lastEleveationChangeTime = 0
    let changeElevationDelay = 0

    let maxSpawnDelay = 1
    const minSpawnDelay = 0.01
    let spawnDelay = .8
    let lastEnemySpawnTime = 0

    this.enemies = enemies

    this.update = function(time) {
        updateSpawnerPolarPosition(time)
        updateSpawnerHeight(time)
        spawnEnemy(time)
        updateEnemies(time)
    }

    function updateSpawnerPolarPosition(time) {
        updateAngleDirection(time)

        angleAccelerator.increaseSpeedOf(gameConstants.speedStep)

        const angleAcceleration = angleAccelerator.getForce(angleDirection)
        currentAngle += angleAcceleration

        const position = polarToCartesian(gameConstants.minRadius, currentAngle)
        spawnerMesh.position.x = position.x
        spawnerMesh.position.z = position.y
        
        spawnerMesh.rotation.y = -currentAngle
    }

    function updateAngleDirection(time) {
        if(time <= lastDirectionChangeTime + changeDirectionDelay)
            return

        angleDirection = getRandom(0, 1) > 0.5 ? 1 : -1
        
        lastDirectionChangeTime = time
        changeDirectionDelay = getRandom(1, 4)
    }

    function updateSpawnerHeight(time) {
        if(time <= lastEleveationChangeTime + changeElevationDelay)
            return

        spawnerMesh.position.y = getRandom(0, 1) > 0.5 ? gameConstants.secondLevelHeight : gameConstants.baseLevelHeight
        
        lastEleveationChangeTime = time
        changeElevationDelay = getRandom(2, 10)
    }

    function spawnEnemy(currentTime) {
        maxSpawnDelay -= gameConstants.speedStep*20
        maxSpawnDelay = maxSpawnDelay < minSpawnDelay * 2 ? maxSpawnDelay*2 : maxSpawnDelay

        if(currentTime - lastEnemySpawnTime < spawnDelay)
            return
        
        enemies.push(new Enemy(scene, gameConstants, spawnerMesh.position))
        lastEnemySpawnTime = currentTime
        spawnDelay = getRandom(minSpawnDelay, maxSpawnDelay)
    }

    function updateEnemies(time) {
        for(let i=0; i<enemies.length; i++) {
            const expired = enemies[i].update(time)

            if(expired)
                removeEnemy(i)
        }
    }

    function removeEnemy(i) {
        if(!enemies[i].collision)
            eventBus.post(decreaseScore)

        enemies.splice(i, 1)
    }
}