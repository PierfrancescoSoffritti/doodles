function PlayerBulletsShooter(scene, gameConstants) {
    const bullets = []
    const bulletsCache = []

    let currentTime = 0
    const shootDelay = .06
    let lastShootTime = 0

    this.bullets = bullets
    this.bulletsColor = "#FFF"

    this.update = function(time) {
        currentTime = time
        for(let i=0; i<bullets.length; i++) {
            const expired = bullets[i].update(time)
           
            if(expired)
                removeBullet(i)
        }
    }

    this.shoot = function(originPosition) {
        if(currentTime - lastShootTime < shootDelay)
            return

        const bullet = bulletsCache.length != 0 ? bulletsCache.pop().reset(originPosition) : new Bullet(scene, originPosition, gameConstants, this.bulletsColor)
        bullets.push(bullet)

        lastShootTime = currentTime
    }

    function removeBullet(i) {
        const bullet = bullets.splice(i, 1)[0]
        bulletsCache.push(bullet)
    }
}

const geometryBulletPlayer = new THREE.SphereBufferGeometry( .4, 16, 16 );
const materialBulletPlayer = new THREE.MeshBasicMaterial( );
const blueprintBulletPlayer = new THREE.Mesh( geometryBulletPlayer, materialBulletPlayer );

function Bullet(scene, originPosition, gameConstants, color) {
    materialBulletPlayer.color = new THREE.Color(color)

    const bulletMesh = blueprintBulletPlayer.clone()
    bulletMesh.position.set(originPosition.x, originPosition.y, originPosition.z)
    scene.add(bulletMesh)
    
    const maxScaleX = getRandom(.5, 1.5);
    const maxScaleY = getRandom(.5, 1.5);
    const maxScaleZ = getRandom(.5, 1.5);
    bulletMesh.scale.set(maxScaleX, maxScaleY, maxScaleZ)

    const speed = 8

    const polarCoords = cartesianToPolar(originPosition.x, originPosition.z)

    this.collision = false
    this.position = bulletMesh.position
    
    this.update = function(time) {
        polarCoords.radius -= speed

        bulletMesh.position.x = (polarCoords.radius) * cos(polarCoords.angle)
        bulletMesh.position.z = (polarCoords.radius) * sin(polarCoords.angle)

        updateScale(polarCoords)

        const expired = ( polarCoords.radius < 0 || this.collision === true ) ? true : false
        if(expired)
            scene.remove(bulletMesh)
            
        return expired
    }

    this.reset = function(newOrigin) {
        const newOriginpolarCoords = cartesianToPolar(newOrigin.x, newOrigin.z)
        
        bulletMesh.position.set(newOrigin.x, newOrigin.y, newOrigin.z)
        polarCoords.radius = newOriginpolarCoords.radius
        polarCoords.angle = newOriginpolarCoords.angle

        this.collision = false

        scene.add(bulletMesh)
        
        return this
    }

    function updateScale(polarCoords) {
        const scaleX =  maxScaleX - ( polarCoords.radius / gameConstants.maxRadius ) * maxScaleX/4
        const scaleY =  maxScaleY - ( polarCoords.radius / gameConstants.maxRadius ) * maxScaleY/4
        const scaleZ =  maxScaleZ - ( polarCoords.radius / gameConstants.maxRadius ) * maxScaleZ/4
        bulletMesh.scale.set( scaleX, scaleY, scaleZ )
    }
}