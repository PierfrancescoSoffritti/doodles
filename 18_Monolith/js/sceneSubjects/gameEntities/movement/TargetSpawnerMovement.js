function TargetSpawnerMovement(mesh, gameConstants) {

    mesh.position.y = gameConstants.baseLevelHeight    

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

    this.reset = function() {
        angleAccelerator.resetSpeed(angleSpeed);
        mesh.position.set(0, gameConstants.baseLevelHeight, 0);
    }
    
    this.update = function(time) {
        updateSpawnerPolarPosition(time)
        updateSpawnerHeight(time)
    }

    function updateSpawnerPolarPosition(time) {
        updateAngleDirection(time)

        angleAccelerator.increaseSpeedOf(gameConstants.speedStep)

        const angleAcceleration = angleAccelerator.getForce(angleDirection)
        currentAngle += angleAcceleration

        const position = polarToCartesian(gameConstants.minRadius, currentAngle)
        mesh.position.x = position.x
        mesh.position.z = position.y
        
        mesh.rotation.y = -currentAngle
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

        const tweenMeshHeight = new TWEEN.Tween(mesh.position)
            .to({ y: height }, 400)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start()
        
        lastEleveationChangeTime = time
        changeElevationDelay = getRandom(2, 10)
    }
}