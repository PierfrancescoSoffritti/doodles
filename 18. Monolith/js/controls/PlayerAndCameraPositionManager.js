function PlayerAndCameraPositionManager(camera, player) {
    this.player = player

    const cameraHeightRelativeFromPlayer = .9
    const playerDistanceFromCamera = 2

    const baseLevelHeight = 5
    const secondLevelHeight = baseLevelHeight + 10

    let lastDirectionX = 0
    let lastDirectionZ = 0

    player.position.y = baseLevelHeight

    this.update = function(time) {
        player.mesh.position.y = sin(time*2)/20
    }

    this.setAcceleration = function(acceleration) {
        player.acceleration = acceleration
        console.log(acceleration)
    }
    
    this.setPosition = function(radius, angle) {
        camera.position.x = radius * cos(angle)
        camera.position.y = player.position.y + cameraHeightRelativeFromPlayer
        camera.position.z = radius * sin(angle)
        camera.lookAt(new THREE.Vector3(0,0,0))
    
        player.position.x = (radius -playerDistanceFromCamera) * cos(angle)
        player.position.z = (radius -playerDistanceFromCamera) * sin(angle)

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

    let heightLevel = 0
    this.changeHeightLevel = function(newHeightLevel) {
        heightLevel = newHeightLevel

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