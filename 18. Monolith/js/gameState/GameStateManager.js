function GameStateManager() {

    this.gameState = {
        playerPosition: new THREE.Vector3(0, 0, 0),
        playerHeightLevel: 0, // 0 or 1

        lives: 0,
        score: 0
    }

    eventBus.subscribe(gameOverEvent, () => {
        this.gameState.playerPosition = new THREE.Vector3(0, 0, 0)
        this.gameState.playerHeightLevel = 0
        
        this.gameState.lives = 0
        this.gameState.score = 0
    })

    this.update = function(time) {
    }
}