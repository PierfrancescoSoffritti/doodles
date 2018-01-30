function PlayerAndCameraPositionManager(camera, player, gameConstants) {
    this.player = player

    const cameraHeightFromPlayer = .6
    const playerDistanceFromCamera = 1.4

    let lastDirectionX = 0
    let lastDirectionZ = 0

    let acceleration = 0

    const cameraPolarPostion = {
        radius: 0,
        angle: 0,
        y : cameraHeightFromPlayer
    }

    const playerPolarPostion = {
        radius: 0,
        angle: 0,
        y: gameConstants.baseLevelHeight
    }

    this.update = function(time) {
        player.mesh.position.x = sin(time/2)/40
        player.mesh.position.y = sin(time*2)/20
        player.mesh.position.z = sin(time)/40

        cameraPolarPostion.radius += sin(time)/10       
        cameraPolarPostion.angle += cos(time)/8000
        cameraPolarPostion.y = cameraHeightFromPlayer + cos(time/2)/16

        cameraPolarPostion.radius += acceleration
        cameraPolarPostion.y += acceleration/3

        updateCameraPosition()
        updatePlayerPosition()
    }

    function updateCameraPosition() {
        const newPolarPositionCamera = polarToCartesian(cameraPolarPostion.radius, cameraPolarPostion.angle)
        
        camera.position.x = newPolarPositionCamera.x
        camera.position.z = newPolarPositionCamera.y

        camera.position.y = playerPolarPostion.y + cameraPolarPostion.y

        camera.lookAt(new THREE.Vector3(0,0,0))
    }

    function updatePlayerPosition() {
        const newPolarPositionPlayer = polarToCartesian(playerPolarPostion.radius, playerPolarPostion.angle)
        player.position.x = newPolarPositionPlayer.x
        player.position.z = newPolarPositionPlayer.y

        player.position.y = playerPolarPostion.y

        player.rotation.y = -playerPolarPostion.angle
    }

    this.setAcceleration = function(a) {
        player.acceleration = a
        acceleration = a       
        
        if(acceleration >= 0.98)
            acceleration = 1
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