function TurretBulletsShooter(scene, position, gameConstants) {
    const bullets = []
    const bulletsCache = []

    let currentTime = 0
    const shootDelay = .015
    let lastShootTime = 0

    this.bullets = bullets

    this.update = function(time) {
        currentTime = time
        for(let i=0; i<bullets.length; i++) {
            const expired = bullets[i].update(time)
           
            if(expired)
                removeBullet(i)
        }
    }

    this.shoot = function(targetPosition, scaleFactor = 1) {
        if(currentTime - lastShootTime < shootDelay)
            return

        const bullet = bulletsCache.length != 0 ? bulletsCache.pop().reset(targetPosition, scaleFactor) 
            : new TurretBullet(scene, gameConstants, position, targetPosition, scaleFactor)
        bullets.push(bullet)

        lastShootTime = currentTime
    }

    function removeBullet(i) {
        const bullet = bullets.splice(i, 1)[0]
        bulletsCache.push(bullet)
    }
}

const geometryTurretBullet = new THREE.SphereBufferGeometry( .8, 16, 16 );
const materialTurretBullet = new THREE.MeshBasicMaterial( {color: "#100000"} );
const blueprintTurretBullet = new THREE.Mesh( geometryTurretBullet, materialTurretBullet );

function TurretBullet(scene, gameConstants, originPosition, targetPosition, scaleFactor) {
    const bulletMesh = blueprintTurretBullet.clone()
    bulletMesh.position.set(originPosition.x, originPosition.y, originPosition.z)
    scene.add(bulletMesh)

    if(scaleFactor != 1)
        bulletMesh.material = new THREE.MeshBasicMaterial( {color: "#810081"} );

    let maxScaleX = getRandom(.1, 1) *scaleFactor
    let maxScaleY = getRandom(.1, 1) *scaleFactor
    let maxScaleZ = getRandom(.1, 1) *scaleFactor
    bulletMesh.scale.set(maxScaleX, maxScaleY, maxScaleZ)

    const direction = new THREE.Vector3()
    direction.subVectors( targetPosition, originPosition ).normalize()

    const step = getRandom(.1, .2)
    let distance = 0

    const maxScale = 1

    this.collision = false

    this.position = bulletMesh.position
    this.boundingSphereRad = 4

    this.update = function(time) {
        distance += step

        bulletMesh.translateOnAxis ( direction, distance )    

        const polarCoordsBullet = cartesianToPolar(bulletMesh.position.x, bulletMesh.position.z)
        const polarCoordsPlayer = cartesianToPolar(targetPosition.x, targetPosition.z)

        updateScale(polarCoordsBullet)

        const expired = ( polarCoordsBullet.radius > polarCoordsPlayer.radius || this.collision === true ) ? true : false
        if(expired) 
            scene.remove(bulletMesh)
            
        return expired
    }

    this.reset = function(newTargetPosition, scaleFactor) {
        bulletMesh.position.set(originPosition.x, originPosition.y, originPosition.z)

        if(scaleFactor != 1)
            bulletMesh.material = new THREE.MeshBasicMaterial( {color: "#810081"} )
        else
            bulletMesh.material = new THREE.MeshBasicMaterial( {color: "#100000"} )

        maxScaleX = getRandom(.1, 1) *scaleFactor
        maxScaleY = getRandom(.1, 1) *scaleFactor
        maxScaleZ = getRandom(.1, 1) *scaleFactor

        distance = 0

        direction.x = direction.y = direction.z = 0
        direction.subVectors( newTargetPosition, originPosition ).normalize()
        scene.add(bulletMesh)

        this.collision = false

        return this
    }

    function updateScale(polarCoords) {
        const scaleX =  maxScaleX - ( polarCoords.radius / gameConstants.maxRadius ) * maxScaleX/2
        const scaleY =  maxScaleY - ( polarCoords.radius / gameConstants.maxRadius ) * maxScaleY/2
        const scaleZ =  maxScaleZ - ( polarCoords.radius / gameConstants.maxRadius ) * maxScaleZ/2
        bulletMesh.scale.set( scaleX, scaleY, scaleZ )
    }
}