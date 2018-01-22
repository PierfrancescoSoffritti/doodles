function Shooter(scene) {

    const bullets = []
    this.bullets = bullets

    let iTime = 0
    const delay = .1
    // const delay = .08
    let lastShootTime = 0

    this.shoot = function(position) {
        if(iTime - lastShootTime < delay)
            return

        bullets.push(new Bullet(scene, position))
        lastShootTime = iTime
    }

    this.update = function(time) {
        iTime = time
        for(let i=0; i<bullets.length; i++) {
            const expired = bullets[i].update(time)
           
            if(expired)
                bullets.splice(i, 1);
        }
    }
}