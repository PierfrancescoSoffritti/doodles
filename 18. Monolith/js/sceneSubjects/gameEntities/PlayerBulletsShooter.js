function PlayerBulletsShooter(scene) {
    const bullets = []

    let currentTime = 0
    const shootDelay = .06
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

    this.shoot = function(originPosition) {
        if(currentTime - lastShootTime < shootDelay)
            return

        bullets.push( new Bullet(scene, originPosition) )
        lastShootTime = currentTime
    }
}

const geometryBulletPlayer = new THREE.SphereBufferGeometry( .4, 16, 16 );
const materialBulletPlayer = new THREE.MeshBasicMaterial( {color: "#0000FF"} );
const blueprintBulletPlayer = new THREE.Mesh( geometryBulletPlayer, materialBulletPlayer );

function Bullet(scene, originPosition) {

    const bulletMesh = blueprintBulletPlayer.clone()
    scene.add(bulletMesh)
    bulletMesh.position.set(originPosition.x, originPosition.y, originPosition.z)
    bulletMesh.scale.set(getRandom(.1, 1), getRandom(.1, 1), getRandom(.1, 1))

    const speed = 8

    const polarCoord = cartesianToPolar(originPosition.x, originPosition.z)

    this.position = bulletMesh.position
    this.collision = false
    
    this.update = function(time) {
        polarCoord.radius -= speed

        bulletMesh.position.x = (polarCoord.radius) * cos(polarCoord.angle)
        bulletMesh.position.z = (polarCoord.radius) * sin(polarCoord.angle)

        const expired = ( polarCoord.radius < 0 || this.collision === true ) ? true : false
        if(expired)
            scene.remove(bulletMesh)
            
        return expired
    }
}