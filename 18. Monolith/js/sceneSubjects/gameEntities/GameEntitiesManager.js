function GameEntitiesManager(scene) {
    const playerShooter = new Shooter(scene)

    const player = new Player( scene, playerShooter )
    const enemiesSpawner = new EnemiesSpawner(scene)

    this.player = player

    this.update = function(time) {
        player.update(time)
        enemiesSpawner.update(time)

        const bullets = playerShooter.bullets
        const enemies = enemiesSpawner.enemies
        
        checkCollision(bullets, enemies)
    }   

    function checkCollision(array1, array2) {
        for(let i=0; i<array1.length; i++) {
            const el1 = array1[i]
            for(let j=0; j<array2.length; j++) {
                const el2 = array2[j]

                // const distance = Math.sqrt(Math.pow(el1.position.x - el2.position.x, 2) + Math.pow(el1.position.z - el2.position.z, 2))

                const distance = el1.position.distanceTo( el2.position );
                if(distance < el2.boundingSphereRad) {
                    el1.collision = true
                    el2.collision = true
                }
            }
        }
    }
}