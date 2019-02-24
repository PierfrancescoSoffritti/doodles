function PolarControls(playerAndCameraPositionManager, gameConstants, gameState) {

    const W = 87
    const A = 65
    const S = 83
    const D = 68

    const angleSpeed = .02
    const radSpeed = 1

    const acceletationMax = 1
    const accelerationIncreaseStep = 0.02
    const accelerationDecreaseStep = 0.009

    const angleAccelerator = new Accelerator(angleSpeed, acceletationMax, accelerationIncreaseStep, accelerationDecreaseStep)
    const radAccelerator = new Accelerator(radSpeed, acceletationMax, accelerationIncreaseStep, accelerationDecreaseStep)

    let currentRadius = gameConstants.maxRadius
    let currentAngle = 0

    let left = false
    let right = false
    let forward = false
    let backward = false

    eventBus.subscribe( startBoost, () => angleAccelerator.boost(1.3) )
    eventBus.subscribe( gameOverEvent, () => { angleAccelerator.resetSpeed(angleSpeed); left = right = forward = backward = false } )

    this.onKeyDown = function(keyCode) {
        gameState.playerHasMoved = true

        if(keyCode === A)
            left = true
        else if(keyCode === D)
            right = true  
        else if(keyCode === W)
            forward = true
        else if(keyCode === S)
            backward = true
    }

    this.onKeyUp = function(keyCode) {
        if(keyCode === A)
            left = false            
        else if(keyCode === D)
            right = false
        else if(keyCode === W)
            forward = false
        else if(keyCode === S)
            backward = false
    }

    this.update = function(time) {
        const angleDirection = left ? 1 : right ? -1 : 0
        const radDirection = forward ? -1 : backward ? 1 : 0

        angleAccelerator.increaseSpeedOf(gameConstants.speedStep)

        const angleAcceleration = angleAccelerator.getForce(angleDirection)
        currentAngle += angleAcceleration

        const radAcceleration = radAccelerator.getForce(radDirection)
        const tRad = currentRadius + radAcceleration
        if(tRad > gameConstants.minRadius && tRad < gameConstants.maxRadius)
            currentRadius = tRad

        playerAndCameraPositionManager.setPosition(currentRadius, currentAngle)
        
        playerAndCameraPositionManager.setAcceleration( Math.max( Math.abs(angleAcceleration*100)/2, Math.abs(radAcceleration) ) )

        playerAndCameraPositionManager.setAngleDirection(angleDirection)
        playerAndCameraPositionManager.setRadiusDirection(radDirection*-1)
    }
}