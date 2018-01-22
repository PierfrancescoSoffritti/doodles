function MouseControls(playerAndCameraPositionManager, player) {

    let currentHeightLevel = 0
    let shoot = false
    
    this.onMouseDown = function(event) {
        switch (event.which) {
            case 1:
                onLeftClickDown()
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
                onLeftClickUp()
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

    function onRightClick() {
        currentHeightLevel = (currentHeightLevel+1) %2
        playerAndCameraPositionManager.changeHeightLevel(currentHeightLevel)
    }

    function onLeftClickDown() {
        shoot = true
    }

    function onLeftClickUp() {
        shoot = false
    }
}