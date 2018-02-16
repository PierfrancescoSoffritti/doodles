function EnemyShooter(scene, position, gameConstants) {
    const bullets = []
    this.bullets = bullets

    let iTime = 0
    const delay = .1
    let lastShootTime = 0

    this.shoot = function(targetPosition) {
        if(iTime - lastShootTime < delay)
            return

        bullets.push( new BulletEnemy(scene, gameConstants, position, targetPosition) )
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

const geometryBulletEnemy = new THREE.SphereBufferGeometry( .4, 16, 16 );
const materialBulletEnemy = new THREE.MeshBasicMaterial( {color: "#FF0000"} );
const blueprintBulletEnemy = new THREE.Mesh( geometryBulletEnemy, materialBulletEnemy );

function BulletEnemy(scene, gameConstants, originPosition, targetPosition) {

    const sphere = blueprintBulletEnemy.clone()
    sphere.scale.set(getRandom(1, 2), getRandom(1, 2), getRandom(1, 2))

    const speed = .2;

    this.position = sphere.position
    this.collision = false

    sphere.position.set(originPosition.x, originPosition.y, originPosition.z)
    scene.add(sphere);

    const polarCoord = cartesianToPolar(originPosition.x, originPosition.z)

    const direction = new THREE.Vector3()
    direction.subVectors( targetPosition, originPosition ).normalize();

    let cont = 0;

    this.update = function(time) {
        cont += speed;
        polarCoord.radius += speed

        sphere.translateOnAxis ( direction, cont )       

        const expired = ( cont > gameConstants.maxRadius/20 || this.collision === true ) ? true : false
        if(expired)
            scene.remove(sphere)
            
        return expired
    }
}