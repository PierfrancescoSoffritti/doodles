const geometry = new THREE.SphereBufferGeometry( 4, 16, 16 );
const material = new THREE.MeshBasicMaterial( {color: "#00FFFF"} );
const blueprintEnemy = new THREE.Mesh( geometry, material );

function Enemy(scene) {
    const sphere = blueprintEnemy.clone()
    const val = getRandom(1, 2)
    sphere.scale.set(val, val, val)

    this.position = sphere.position
    this.collision = false;

    const speed = 1;
    scene.add(sphere);

    let radius = 20
    let angle = getRandom(0, Math.PI*2)

    this.update = function(time) {
        radius += speed

        sphere.position.x = radius * cos(angle)
        sphere.position.z = radius * sin(angle)

        const expired = ( radius > 200 || this.collision === true ) ? true : false

        if(expired)
            scene.remove(sphere)
            
        return expired
    }
}