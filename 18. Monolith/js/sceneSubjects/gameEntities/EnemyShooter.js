function EnemyShooter(scene, position, gameConstants) {
    const bullets = []

    let currentTime = 0
    const shootDelay = .1
    let lastShootTime = 0

    this.shoot = function(targetPosition) {
        if(currentTime - lastShootTime < shootDelay)
            return

        bullets.push( new BulletEnemy(scene, gameConstants, position, targetPosition) )
        lastShootTime = currentTime
    }

    this.update = function(time) {
        currentTime = time
        for(let i=0; i<bullets.length; i++) {
            const expired = bullets[i].update(time)
           
            if(expired)
                bullets.splice(i, 1);
        }
    }
}

const geometryBulletEnemy = new THREE.SphereBufferGeometry( .4, 16, 16 );
const materialBulletEnemy = new THREE.MeshBasicMaterial( {color: "#FF0000"} );
const blueprintBulletEnemy = new THREE.Mesh( geometryBulletEnemy, materialBulletEnemy );

function BulletEnemy(scene, gameConstants, originPosition, targetPosition) {

    const sphere = blueprintBulletEnemy.clone()
    sphere.scale.set(getRandom(1, 2), getRandom(1, 2), getRandom(1, 2))

    this.position = sphere.position
    this.collision = false

    sphere.position.set(originPosition.x, originPosition.y, originPosition.z)
    scene.add(sphere)

    const direction = new THREE.Vector3()
    direction.subVectors( targetPosition, originPosition ).normalize()

    const speed = .2
    let distance = 0

    this.update = function(time) {
        distance += speed;

        sphere.translateOnAxis ( direction, distance )       

        const expired = ( distance > gameConstants.maxRadius/20 || this.collision === true ) ? true : false
        if(expired)
            scene.remove(sphere)
            
        return expired
    }
}