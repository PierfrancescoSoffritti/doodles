function TurretBulletsShooter(scene, position, gameConstants) {
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

    this.shoot = function(targetPosition, scaleFactor = 1) {
        if(currentTime - lastShootTime < shootDelay)
            return

        bullets.push( new TurretBullet(scene, gameConstants, position, targetPosition, scaleFactor) )
        lastShootTime = currentTime
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

    const maxScaleX = getRandom(.1, 1) *scaleFactor
    const maxScaleY = getRandom(.1, 1) *scaleFactor
    const maxScaleZ = getRandom(.1, 1) *scaleFactor
    bulletMesh.scale.set(maxScaleX, maxScaleY, maxScaleZ)

    const direction = new THREE.Vector3()
    direction.subVectors( targetPosition, originPosition ).normalize()

    const step = getRandom(.1, .2)
    let distance = 0

    const maxScale = 1

    this.position = bulletMesh.position
    this.boundingSphereRad = 4
    this.collision = false

    this.update = function(time) {
        distance += step

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
        const scaleX =  maxScaleX - ( polarCoords.radius / gameConstants.maxRadius ) * maxScaleX/2
        const scaleY =  maxScaleY - ( polarCoords.radius / gameConstants.maxRadius ) * maxScaleY/2
        const scaleZ =  maxScaleZ - ( polarCoords.radius / gameConstants.maxRadius ) * maxScaleZ/2
        bulletMesh.scale.set( scaleX, scaleY, scaleZ )
    }
}