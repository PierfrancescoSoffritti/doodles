const geometryBullet = new THREE.SphereBufferGeometry( .8, 16, 16 );
const materialBullet = new THREE.MeshBasicMaterial( {color: "#0000FF"} );
const blueprintBullet = new THREE.Mesh( geometryBullet, materialBullet );

function Bullet(scene, origin) {

    const sphere = blueprintBullet.clone()
    sphere.scale.set(getRandom(.1, 1), getRandom(.1, 1), getRandom(.1, 1))
    // const val = getRandom(.1, )
    // sphere.scale.set(val, val, val)

    const speed = 5;

    this.position = sphere.position
    this.collision = false

    sphere.position.x = origin.x
    sphere.position.y = origin.y
    sphere.position.z = origin.z
    scene.add(sphere);

    const polarCoord = cartesianToPolar(origin.x, origin.z)

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