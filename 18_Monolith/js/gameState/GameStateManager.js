function GameStateManager() {

    const maxLives = 4

    this.gameConstants = {
        monolithRadius: 25,
        minRadius: 50,
        maxRadius: 200,
        baseLevelHeight: 15,
        secondLevelHeight: 25,

        turretsHeight: 20,

        speedStep: 0,
    }

    this.gameState = {
        playerPosition: new THREE.Vector3(0, 0, 0),
        playerHeightLevel: 0, // 0 or 1

        lives: maxLives,
        score: 0,

        playerHasMoved: false,
        enableUserInput: false
    }

    eventBus.subscribe( introScreenClosed, () => this.gameState.enableUserInput = true )
    eventBus.subscribe( startCountDownFinishedEvent, () => {
        this.gameConstants.speedStep = 0.0000008;
    } )

    eventBus.subscribe(gameOverEvent, () => {
        this.gameState.playerHeightLevel = 0        
        this.gameState.lives = maxLives
        this.gameState.score = 0
        this.gameState.enableUserInput = false

        this.gameConstants.speedStep = 0
    })

    this.update = function(time) {
    }
}