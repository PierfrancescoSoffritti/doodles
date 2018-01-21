function MouseControls(camera, player) {

    let level = 0
    const yMovement = 10
    const yBase = 5

    let shoot = false

    player.position.y = yBase

    function onRightClick() {
        if(level === 0) {
            camera.position.y = yBase + yMovement
            player.position.y = yBase + yMovement
            level++
        } else {
            camera.position.y = yBase 
            player.position.y = yBase 
            level--
        }
    }
    
    this.onMouseDown = function(event) {
        switch (event.which) {
            case 1:
                shoot = true;
                break;
            case 2:
                // Middle Mouse button pressed
                break;
            case 3:
                onRightClick()
                break;
            default:
                console.error("unknown mouse button")
        }
    }

    this.onMouseUp = function(event) {
        switch (event.which) {
            case 1:
                shoot = false;
                break;
            case 2:
                // Middle Mouse button pressed
                break;
            case 3:
                
                break;
            default:
                console.error("unknown mouse button")
        }
    }

    this.update = function(time) {
        if(shoot)
            player.shoot()
    }
}