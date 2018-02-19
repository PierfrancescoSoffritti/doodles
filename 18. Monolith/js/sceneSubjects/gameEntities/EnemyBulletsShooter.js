function EnemyBulletsShooter(scene, position, gameConstants) {
    const bullets = []

    let currentTime = 0
    const shootDelay = .015
    let lastShootTime = 0

    this.bullets = bullets

    this.update = function(time) {
        currentTime = time
        for(let i=0; i<bullets.length; i++) {
            const expired = bullets[i].update(time)
           
            if(expired)
                bullets.splice(i, 1);
        }
    }

    this.shoot = function(targetPosition) {
        if(currentTime - lastShootTime < shootDelay)
            return

        bullets.push( new BulletEnemy(scene, gameConstants, position, targetPosition) )
        lastShootTime = currentTime
    }
}

const geometryBulletEnemy = new THREE.SphereBufferGeometry( .8, 16, 16 );
const materialBulletEnemy = new THREE.MeshBasicMaterial( {color: "#FF0000"} );
const blueprintBulletEnemy = new THREE.Mesh( geometryBulletEnemy, materialBulletEnemy );

function BulletEnemy(scene, gameConstants, originPosition, targetPosition) {

    const bulletMesh = blueprintBulletEnemy.clone()
    scene.add(bulletMesh)
    bulletMesh.position.set(originPosition.x, originPosition.y, originPosition.z)
    bulletMesh.scale.set(getRandom(.1, 1), getRandom(.1, 1), getRandom(.1, 1))

    bulletMesh.rotation = -cartesianToPolar(originPosition.x, cartesianToPolar.z).radius

    const direction = new THREE.Vector3()
    direction.subVectors( targetPosition, originPosition ).normalize()

    const speed = .2
    let distance = 0

    const maxScale = 1

    this.position = bulletMesh.position
    this.boundingSphereRad = 4
    this.collision = false

    this.update = function(time) {
        distance += speed

        bulletMesh.translateOnAxis ( direction, distance )    
        // sphere.position.add( direction.clone().multiplyScalar( distance ) )

        const polarCoordsBullet = cartesianToPolar(bulletMesh.position.x, bulletMesh.position.z)
        const polarCoordsPlayer = cartesianToPolar(targetPosition.x, targetPosition.z)

        updateScale(polarCoordsBullet)

        const expired = ( polarCoordsBullet.radius > polarCoordsPlayer.radius || this.collision === true ) ? true : false
        if(expired) 
            scene.remove(bulletMesh)
            
        return expired
    }

    function updateScale(polarCoords) {
        const scale =  maxScale - ( ( .8 * polarCoords.radius ) / gameConstants.maxRadius )
        bulletMesh.scale.set( scale, scale, scale )
    }
}