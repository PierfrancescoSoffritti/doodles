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

    let radius = Math.sqrt( Math.pow(origin.x, 2) + Math.pow(origin.z, 2) )
    let angle = Math.atan( origin.z / origin.x )
    
    if(origin.x < 0 && origin.z > 0)
        angle += Math.PI
    else if(origin.x < 0 && origin.z < 0)
        angle += Math.PI
    else if(origin.x > 0 && origin.z < 0)
        angle += Math.PI*2

    this.update = function(time) {
        radius -= speed

        sphere.position.x = (radius) * cos(angle)
        sphere.position.z = (radius) * sin(angle)


        const expired = ( radius < 0 || this.collision === true ) ? true : false
        if(expired)
            scene.remove(sphere)
            
        return expired
    }
}