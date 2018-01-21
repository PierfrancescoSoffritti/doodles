function EnemiesSpawner(scene) {
    const enemies = []
    this.enemies = enemies

    const delay = 1
    let lastEnemySpawnTime = 0

    function spawnEnemy(currentTime) {
        if(currentTime - lastEnemySpawnTime < delay)
            return
        
        enemies.push(new Enemy(scene))
        lastEnemySpawnTime = currentTime
    }

    this.update = function(time) {
        spawnEnemy(time)

        for(let i=0; i<enemies.length; i++) {
            const expired = enemies[i].update(time)

            if(expired)
                enemies.splice(i, 1);
        }
    }
}