function EnemiesSpawner(scene, gameConstants) {
    const enemies = []

    spawnerMesh = buildMesh(scene)
    
    spawnerMesh.position.y = gameConstants.baseLevelHeight    

    const angleSpeed = .006
    const acceletationMax = 1
    const accelerationIncreaseStep = 0.02
    const accelerationDecreaseStep = 0.009
    const angleAccelerator = new Accelerator(angleSpeed, acceletationMax, accelerationIncreaseStep, accelerationDecreaseStep)

    let currentAngle = 0
    let angleDirection = 1
    let lastDirectionChangeTime = 0
    let changeDirectionDelay = 0

    let lastEleveationChangeTime = 0
    let changeElevationDelay = 0

    const originalMaxSpawnDelay = 1
    let maxSpawnDelay = 1
    const minSpawnDelay = 0.01
    let spawnDelay = .8
    let lastEnemySpawnTime = 0

    this.enemies = enemies

    eventBus.subscribe( gameOverEvent, () => { 
        angleAccelerator.resetSpeed(angleSpeed);
        maxSpawnDelay = originalMaxSpawnDelay;
        spawnerMesh.position.set(0, gameConstants.baseLevelHeight, 0);
        destroyEnemies()
    } )

    this.update = function(time) {
        for(var i=0; i<spawnerMesh.children.length; i++) {
            var child = spawnerMesh.children[i];
            child.position.x = sin(time*8) *i
        }

        updateSpawnerPolarPosition(time)
        updateSpawnerHeight(time)
        spawnEnemy(time)
        updateEnemies(time)
    }

    function buildMesh(scene) {
        var group = new THREE.Group();

        var radius = 4;

        var geometry = new THREE.TorusGeometry(radius, .6, 32, 128);
        var material = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9  });

        var envMap = new THREE.TextureLoader().load('textures/envMap.png');
        envMap.mapping = THREE.SphericalReflectionMapping;
        material.envMap = envMap;

        var mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.y = Math.PI/2
        group.add(mesh);

        for(var i=4; i>=1; i--) {
            var temp = mesh.clone();
            temp.scale.set(i*0.20, i*0.20, i*0.20)
            group.add(temp);
        }

        scene.add(group)

        return group
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

        const height = getRandom(0, 1) > 0.5 ? gameConstants.secondLevelHeight : gameConstants.baseLevelHeight

        const tween = new TWEEN.Tween(spawnerMesh.position)
            .to({ y: height }, 400)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
        
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

    function destroyEnemies() {
        while(enemies.length > 0) {
            const enemy = enemies.pop()
            enemy.destroy()
        }
    }

    function removeEnemy(i) {
        if(!enemies[i].collision)
            eventBus.post(decreaseScore)

        enemies.splice(i, 1)
    }
}