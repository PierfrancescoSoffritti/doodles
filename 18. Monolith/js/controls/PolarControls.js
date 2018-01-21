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

    const angleSpeed = .02
    const radSpeed = 1

    const acceletationMax = 1
    const accelerationIncreaseStep = 0.04
    const accelerationDecreaseStep = 0.014

    const angleAccelerator = new Accelerator(angleSpeed, acceletationMax, accelerationIncreaseStep, accelerationDecreaseStep)
    const radAccelerator = new Accelerator(radSpeed, acceletationMax, accelerationIncreaseStep, accelerationDecreaseStep)

    this.onKeyDown = function(keyCode) {
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
        else if(keyCode === W && radius > minRadius)
            forward = false
        else if(keyCode === S && radius < maxRadius)
            backward = false
    }

    this.update = function(time) {
        angle += angleAccelerator.getForce(left ? 1 : right ? -1 : 0)
        
        const tRad = radius + radAccelerator.getForce(forward ? -1 : backward ? 1 : 0)
        if(tRad > minRadius && tRad < maxRadius)
            radius = tRad

        setPosition(camera, player, radius, angle)
    }
    
    function setPosition(camera, player, radius, angle) {
    
        camera.position.x = radius * cos(angle)
        camera.position.y = player.position.y + 2
        camera.position.z = radius * sin(angle)
        camera.lookAt(new THREE.Vector3(0,0,0))
    
        player.position.x = (radius -5) * cos(angle)
        player.position.z = (radius -5) * sin(angle)

        player.rotation.y = -angle
    }


}