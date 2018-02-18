function PlayerBulletsShooter(scene) {

    const bullets = []
    this.bullets = bullets

    let iTime = 0
    const delay = .1
    let lastShootTime = 0

    this.shoot = function(originPosition) {
        if(iTime - lastShootTime < delay)
            return

        bullets.push( new Bullet(scene, originPosition) )
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

const geometryBullet = new THREE.SphereBufferGeometry( .4, 16, 16 );
const materialBullet = new THREE.MeshBasicMaterial( {color: "#0000FF"} );
const blueprintBullet = new THREE.Mesh( geometryBullet, materialBullet );

function Bullet(scene, originPosition) {

    const sphere = blueprintBullet.clone()
    sphere.scale.set(getRandom(.1, 1), getRandom(.1, 1), getRandom(.1, 1))

    const speed = 5;

    this.position = sphere.position
    this.collision = false

    sphere.position.set(originPosition.x, originPosition.y, originPosition.z)
    scene.add(sphere);

    const polarCoord = cartesianToPolar(originPosition.x, originPosition.z)
    
    this.update = function(time) {
        polarCoord.radius -= speed

        sphere.position.x = (polarCoord.radius) * cos(polarCoord.angle)
        sphere.position.z = (polarCoord.radius) * sin(polarCoord.angle)

        const expired = ( polarCoord.radius < 0 || this.collision === true ) ? true : false
        if(expired)
            scene.remove(sphere)
            
        return expired
    }
}