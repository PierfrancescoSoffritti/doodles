function GameEntitiesManager(scene, gameConstants, gameState) {
    const playerShooter = new PlayerBulletsShooter(scene, gameConstants)

    const player = new Player( scene, gameState, playerShooter )
    const monolith = new Monolith(scene, gameConstants)

    const targetsSpawner = new TargetsSpawner(scene, gameConstants)

    const turrets = new Turrets(scene, gameConstants, gameState)

    this.player = player

    let gameStarted = false
    eventBus.subscribe( startCountDownFinishedEvent, () => gameStarted = true )
    eventBus.subscribe( gameOverEvent, () => gameStarted = false )

    this.update = function(time) {
        player.update(time)
        monolith.update(time)  
        turrets.update(time)
        playerShooter.update(time)

        if(!gameStarted)
            return

        targetsSpawner.update(time)

        const playerBullets = playerShooter.bullets
        const targets = targetsSpawner.targets

        const enemyBullets = turrets.getBullets();
        
        checkCollisionWithTargets(playerBullets, targets)
        checkCollisionWithPlayer(enemyBullets, player)
    }   

    function checkCollisionWithTargets(playerBullets, targets) {
        for(let i=0; i<playerBullets.length; i++) {
            const bullet = playerBullets[i]
            
            for(let j=0; j<targets.length; j++) {
                const target = targets[j]

                if(target.collision === true)
                    continue

                const distance = bullet.position.distanceTo( target.position );
                if(distance < target.boundingSphereRad) {
                    bullet.collision = true
                    target.collision = true

                    eventBus.post(increaseScore)
                }
            }
        }
    }

    function checkCollisionWithPlayer(array1, player) {
        for(let i=0; i<array1.length; i++) {
            const el1 = array1[i]

            const distance = el1.position.distanceTo( player.position );
            if(distance < el1.boundingSphereRad) {
                el1.collision = true
                
                player.takeDamage()
            }
        }
    }
}