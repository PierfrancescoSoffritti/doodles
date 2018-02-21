function PlayerAndCameraPositionManager(camera, player, gameConstants, gameState) {
    const cameraHeightFromPlayer = { value: .6, offset: 0 }
    const playerDistanceFromCamera = 1.4

    let lastAngleDirection = 0
    let lastRadiusDirection = 0

    let acceleration = 0

    const cameraPolarPostion = {
        radius: 0,
        angle: 0,
        y: cameraHeightFromPlayer.value
    }

    const playerPolarPostion = {
        radius: 0,
        angle: 0,
        y: gameState.playerHeightLevel === 0 ? gameConstants.baseLevelHeight : gameConstants.secondLevelHeight
    }

    const cameraLookAt = new THREE.Vector3(0, 100, 0)

    eventBus.subscribe(gameOverEvent, () => {
        const tween = new TWEEN.Tween(cameraHeightFromPlayer)
            .to({ offset: 80 }, 1500)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
    })

    eventBus.subscribe(introScreenClosed, () => { 
        const tweenCameraLookAt = new TWEEN.Tween(cameraLookAt)
            .to({ y: 10 }, 1500)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();

        const tweenCameraHeight = new TWEEN.Tween(cameraHeightFromPlayer)
            .to({ offset: 0 }, 1500)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
     })

    this.update = function(time) {
        player.mesh.position.x = sin(time/2)/40
        player.mesh.position.y = sin(time*2)/20
        player.mesh.position.z = sin(time)/40

        // camera static movement
        cameraPolarPostion.radius += sin(time)/10       
        cameraPolarPostion.angle += cos(time)/8000
        
        cameraPolarPostion.y = cameraHeightFromPlayer.value + cos(time/2)/16 +cameraHeightFromPlayer.offset

        // camera acceleration movmenet
        const acc = acceleration >=  0.975 ? 1/2 : acceleration/2
        cameraPolarPostion.radius += sin(acc)*2
        cameraPolarPostion.y += sin(acc)/1.5

        cameraPolarPostion.angle += cameraAngleStearingOffset.val

        updateCameraPosition()
        updatePlayerPosition()
    }

    function updateCameraPosition() {
        const newPolarPositionCamera = polarToCartesian(cameraPolarPostion.radius, cameraPolarPostion.angle)
        
        camera.position.x = newPolarPositionCamera.x
        camera.position.z = newPolarPositionCamera.y

        camera.position.y = playerPolarPostion.y + cameraPolarPostion.y

        camera.lookAt(cameraLookAt)
    }

    function updatePlayerPosition() {
        const newPolarPositionPlayer = polarToCartesian(playerPolarPostion.radius, playerPolarPostion.angle)
        player.position.x = newPolarPositionPlayer.x
        player.position.z = newPolarPositionPlayer.y

        player.position.y = playerPolarPostion.y

        player.rotation.y = -playerPolarPostion.angle

        gameState.playerPosition = player.position
    }

    this.setAcceleration = function(a) {
        player.acceleration = a
        acceleration = a
    }
    
    this.setPosition = function(radius, angle) {
        cameraPolarPostion.radius = radius
        cameraPolarPostion.angle = angle

        playerPolarPostion.radius = radius-playerDistanceFromCamera
        playerPolarPostion.angle = angle
    }

    const cameraAngleStearingOffset = { val: 0 }
    this.setAngleDirection = function(direction) {
        if(direction === lastAngleDirection)
            return
        lastAngleDirection = direction

        const tween = new TWEEN.Tween(player.mesh.rotation)
            .to({ x: direction*Math.PI/8 }, 1000)
            .easing(TWEEN.Easing.Sinusoidal.InOut)
            .start();

        const tween2 = new TWEEN.Tween(cameraAngleStearingOffset)
            .to({ val: -direction/400 }, 1000)
            .easing(TWEEN.Easing.Sinusoidal.InOut)
            .start();
    }

    this.setRadiusDirection = function(direction) {
        if(direction === lastRadiusDirection)
            return
        lastRadiusDirection = direction

        const tween = new TWEEN.Tween(player.mesh.rotation)
            .to({ z: direction*Math.PI/8 }, 600)
            .easing(TWEEN.Easing.Sinusoidal.InOut)
            .start();
    }

    let heightLevel = 0
    this.changeHeightLevel = function(newHeightLevel) {
        heightLevel = newHeightLevel

        if(newHeightLevel === 0) {
            const tween = new TWEEN.Tween(playerPolarPostion)
                .to({ y: gameConstants.baseLevelHeight }, 400)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        } else {            
            const tween = new TWEEN.Tween(playerPolarPostion)
                .to({ y: gameConstants.secondLevelHeight }, 400)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }
    }
}