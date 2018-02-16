function GameEntitiesManager(scene, gameConstants, gameState) {
    const playerShooter = new BulletsShooter(scene)
    // const monolithLaserShooter = new LaserShooter(scene, gameConstants)

    const player = new Player( scene, playerShooter )
    const monolith = new Monolith(scene, gameConstants)

    // const enemiesSpawner = new EnemiesSpawner(scene, gameConstants)
    // const boostSpawner = new BoostSpawner(scene, gameConstants)

    const targets = new Targets(scene, gameConstants, gameState)

    this.player = player

    this.update = function(time) {
        player.update(time)
        monolith.update(time)  
        targets.update(time)

        // monolithLaserShooter.update(time, 0, gameConstants.monolithRadius)

        // enemiesSpawner.update(time)
        // boostSpawner.update(time)
        playerShooter.update(time)

        const bullets = playerShooter.bullets
        // const enemies = enemiesSpawner.enemies
        
        // checkCollision(bullets, enemies)
        // boostSpawner.checkCollision(player.position)
        // const isCollision = monolithLaserShooter.checkCollision(player.position)
        
        // if(isCollision)
        //     player.takeDamage();
    }   

    function checkCollision(array1, array2) {
        for(let i=0; i<array1.length; i++) {
            const el1 = array1[i]
            for(let j=0; j<array2.length; j++) {
                const el2 = array2[j]

                const distance = el1.position.distanceTo( el2.position );
                if(distance < el2.boundingSphereRad) {
                    el1.collision = true
                    el2.collision = true
                }
            }
        }
    }
}