function MouseControls( gameState, playerAndCameraPositionManager, player ) {

    let shoot = false

    eventBus.subscribe(gameOverEvent, onLeftClickUp )
    
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
        
    }

    function onRightClick() {
        gameState.playerHeightLevel = (gameState.playerHeightLevel +1 ) %2
        playerAndCameraPositionManager.changeHeightLevel( gameState.playerHeightLevel )
    }

    function onLeftClickDown() {
        player.shoot = true
    }

    function onLeftClickUp() {
        player.shoot = false
    }
}