function PlayerAndCameraPositionManager(camera, player) {
    this.player = player

    const cameraHeightRelativeToPlayer = .9
    const playerPositionRelativeToCamera = 2

    const baseLevelHeight = 5
    const secondLevelHeight = baseLevelHeight + 10

    let lastDirectionX = 0
    let lastDirectionZ = 0

    player.position.y = baseLevelHeight
    
    this.setPosition = function(radius, angle) {
        camera.position.x = radius * cos(angle)
        camera.position.y = player.position.y + cameraHeightRelativeToPlayer
        camera.position.z = radius * sin(angle)
        camera.lookAt(new THREE.Vector3(0,0,0))
    
        player.position.x = (radius -playerPositionRelativeToCamera) * cos(angle)
        player.position.z = (radius -playerPositionRelativeToCamera) * sin(angle)

        player.rotation.y = -angle
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

    this.changeHeightLevel = function(newHeightLevel) {
        if(newHeightLevel === 0) {
            const tween = new TWEEN.Tween(player.position)
                .to({ y: baseLevelHeight }, 400)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        } else {            
            const tween = new TWEEN.Tween(player.position)
                .to({ y: secondLevelHeight }, 400)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }
    }
}