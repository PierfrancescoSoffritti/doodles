function TargetsSpawner(scene, gameConstants) {
    const targets = []
    const targetsCache = []

    const spawnerMesh = buildSpawnerMesh(scene)    
    const spawnerMovement = new TargetSpawnerMovement(spawnerMesh, gameConstants)

    const originalMaxSpawnDelay = 1
    let maxSpawnDelay = 1
    const minSpawnDelay = 0.01
    let spawnDelay = .8
    let lastTargetSpawnTime = 0

    this.targets = targets

    eventBus.subscribe( gameOverEvent, () => { 
        spawnerMovement.reset();        
        maxSpawnDelay = originalMaxSpawnDelay
        destroyTargets()
    } )

    this.update = function(time) {
        spawnerMovement.update(time)

        animateSpawnerMesh(time)
        spawnTarget(time)
        updateTargets(time)
    }

    function buildSpawnerMesh(scene) {
        const group = new THREE.Group()
        scene.add(group)

        const radius = 4
        const torusGeometry = new THREE.TorusGeometry(radius, .6, 32, 32)
        const torusMaterial = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0, metalness: .9 })

        const envMap = new THREE.TextureLoader().load('textures/envMap.png')
        envMap.mapping = THREE.SphericalReflectionMapping
        torusMaterial.envMap = envMap

        const torusMesh = new THREE.Mesh(torusGeometry, torusMaterial)
        torusMesh.rotation.y = Math.PI/2
        group.add(torusMesh)

        for(let i=4; i>=1; i--) {
            const tempMesh = torusMesh.clone();
            tempMesh.scale.set(i*0.20, i*0.20, i*0.20)
            group.add(tempMesh)
        }

        return group
    }

    function animateSpawnerMesh(time) {
        for(let i=0; i<spawnerMesh.children.length; i++) {
            const child = spawnerMesh.children[i];
            child.position.x = sin(time*8) *i
        }
    }

    function spawnTarget(currentTime) {
        maxSpawnDelay -= gameConstants.speedStep*20
        maxSpawnDelay = maxSpawnDelay < minSpawnDelay * 2 ? maxSpawnDelay*2 : maxSpawnDelay

        if(currentTime - lastTargetSpawnTime < spawnDelay)
            return
        
        const target = targetsCache.length != 0 ? targetsCache.pop().reset(spawnerMesh.position) : new Target(scene, gameConstants, spawnerMesh.position)
        targets.push(target)

        lastTargetSpawnTime = currentTime
        spawnDelay = getRandom(minSpawnDelay, maxSpawnDelay)
    }

    function updateTargets(time) {
        for(let i=0; i<targets.length; i++) {
            const removed = targets[i].update(time)

            if(removed)
                removeTarget(i)
        }
    }

    function removeTarget(i) {
        if(!targets[i].collision)
            eventBus.post(decreaseScore)

        const target = targets.splice(i, 1)[0]
        targetsCache.push(target)
    }

    function destroyTargets() {
        while(targets.length > 0) {
            const target = targets.pop()
            target.destroy()
        }
    }
}