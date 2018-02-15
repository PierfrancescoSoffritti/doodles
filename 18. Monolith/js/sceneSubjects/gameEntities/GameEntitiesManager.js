function GameEntitiesManager(scene, gameConstants, camera) {
    const playerShooter = new BulletsShooter(scene)
    const monolithLaserShooter = new LaserShooter(scene, gameConstants)

    const player = new Player( scene, playerShooter )
    const monolith = new Monolith(scene, monolithLaserShooter)

    const enemiesSpawner = new EnemiesSpawner(scene)
    const boostSpawner = new BoostSpawner(scene, gameConstants)

    this.player = player

    this.update = function(time) {
        player.update(time)
        monolith.update(time)  

        enemiesSpawner.update(time)
        boostSpawner.update(time)
        playerShooter.update(time)

        const bullets = playerShooter.bullets
        const enemies = enemiesSpawner.enemies
        
        checkCollision(bullets, enemies)
        boostSpawner.checkCollision(player.position)
        const isCollision = monolithLaserShooter.checkCollision(player.position)
        
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