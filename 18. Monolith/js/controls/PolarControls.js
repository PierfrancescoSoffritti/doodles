function PolarControls(camera, player, radius = 200, angle = 0) {

    const W = 87
    const A = 65
    const S = 83
    const D = 68

    const minRadius = 100
    const maxRadius = radius

    let left = false
    let right = false
    let forward = false
    let backward = false

    this.onKeyDown = function(keyCode) {
        if(keyCode === A) {
            left = true
            right = false
        } else if(keyCode === D) {
            left = false
            right = true  
        } else if(keyCode === W) {
            forward = true
            backward = false
        } else if(keyCode === S) {
            forward = false
            backward = true
        }
    }

    this.onKeyUp = function(keyCode) {
        if(keyCode === A)
            left = false            
        else if(keyCode === D)
            right = false
        else if(keyCode === W && radius > minRadius)
            forward = false
        else if(keyCode === S && radius < maxRadius)
            backward = false
    }

    const speed = .02
    const maxAcceletation = 1
    let acceleration = 0

    this.update = function(time) {
        if(Math.abs(acceleration) !== 0)
            acceleration = Math.sign(acceleration) * ( Math.abs(acceleration) - 0.014 )
        if(Math.abs(acceleration) < 0.01)
            acceleration = 0

        if(left)
            if(acceleration < maxAcceletation)
                acceleration += 0.04
            else
                acceleration = maxAcceletation
            angle += speed * acceleration

            // angle += .04
        if(right)
            if(Math.abs(acceleration) < maxAcceletation)
                acceleration -= 0.04
            else
                acceleration = -maxAcceletation
            angle += speed * acceleration

            // angle -= .04
        if(forward && radius > minRadius)
            radius--
        if(backward && radius < maxRadius)
            radius++

        setPosition(camera, radius, angle)
    }
    
    function setPosition(camera, radius, angle) {
    
        camera.position.x = radius * cos(angle)
        camera.position.y = player.position.y + 2
        camera.position.z = radius * sin(angle)
        camera.lookAt(new THREE.Vector3(0,0,0))
    
        player.position.x = (radius -5) * cos(angle)
        player.position.z = (radius -5) * sin(angle)

        player.rotation.y = -angle
    }


}