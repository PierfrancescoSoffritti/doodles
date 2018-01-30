function PlayerAndCameraPositionManager(camera, player, gameConstants) {
    this.player = player

    const cameraHeightFromPlayer = .6
    const playerDistanceFromCamera = 1.4

    let lastDirectionX = 0
    let lastDirectionZ = 0

    player.position.y = gameConstants.baseLevelHeight

    const cameraPolarPostion = {
        radius: 0,
        angle: 0
    }

    const playerPolarPostion = {
        radius: 0,
        angle: 0
    }

    this.update = function(time) {
        player.mesh.position.x = sin(time/2)/40
        player.mesh.position.y = sin(time*2)/20
        player.mesh.position.z = sin(time)/40

        cameraPolarPostion.radius += sin(time)/8
        // cameraPolarPostion.angle += sin(time/2)/1400

        updateCameraPosition()
        updatePlayerPosition()
    }

    function updateCameraPosition() {
        const newPolarPositionCamera = polarToCartesian(cameraPolarPostion.radius, cameraPolarPostion.angle)
        
        camera.position.x = newPolarPositionCamera.x
        camera.position.z = newPolarPositionCamera.y
        camera.position.y = player.position.y + cameraHeightFromPlayer
        camera.lookAt(new THREE.Vector3(0,0,0))
    }

    function updatePlayerPosition() {
        const newPolarPositionPlayer = polarToCartesian(playerPolarPostion.radius, playerPolarPostion.angle)
        player.position.x = newPolarPositionPlayer.x
        player.position.z = newPolarPositionPlayer.y

        player.rotation.y = -playerPolarPostion.angle
    }

    this.setAcceleration = function(acceleration) {
        player.acceleration = acceleration
    }
    
    this.setPosition = function(radius, angle) {
        cameraPolarPostion.radius = radius
        cameraPolarPostion.angle = angle

        playerPolarPostion.radius = radius-playerDistanceFromCamera
        playerPolarPostion.angle = angle
    }

    this.setRotationDirectionX = function(direction) {
        if(direction === lastDirectionX)
            return
        lastDirectionX = direction

        const tween = new TWEEN.Tween(player.mesh.rotation)
            .to({ x: direction*Math.PI/8 }, 400)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
    }

    this.setRotationDirectionZ = function(direction) {
        if(direction === lastDirectionZ)
            return
        lastDirectionZ = direction

        const tween = new TWEEN.Tween(player.mesh.rotation)
            .to({ z: direction*Math.PI/8 }, 400)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
    }

    let heightLevel = 0
    this.changeHeightLevel = function(newHeightLevel) {
        heightLevel = newHeightLevel

        if(newHeightLevel === 0) {
            const tween = new TWEEN.Tween(player.position)
                .to({ y: gameConstants.baseLevelHeight }, 400)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        } else {            
            const tween = new TWEEN.Tween(player.position)
                .to({ y: gameConstants.secondLevelHeight }, 400)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }
    }
}