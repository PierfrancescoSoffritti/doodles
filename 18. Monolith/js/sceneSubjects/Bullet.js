const geometry = new THREE.SphereBufferGeometry( .8, 16, 16 );
const material = new THREE.MeshBasicMaterial( {color: "#0000FF"} );
const blueprint = new THREE.Mesh( geometry, material );

function Bullet(scene, origin) {

    const sphere = blueprint.clone()
    sphere.scale.set(getRandom(.1, 2), getRandom(.1, 2), getRandom(.1, 2))

    const speed = 5;

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

        sphere.position.x = (radius -5) * cos(angle)
        sphere.position.z = (radius -5) * sin(angle)


        const expired = radius < 0 ? true : false
        if(expired)
            scene.remove(sphere)
            
        return expired
    }
}