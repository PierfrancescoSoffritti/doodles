const radiusBox = 4
const geometry = new THREE.SphereBufferGeometry( radiusBox, 16, 16 );
const material = new THREE.MeshBasicMaterial( {color: "#00FFFF"} );
const blueprintEnemy = new THREE.Mesh( geometry, material );

function Enemy(scene) {
    const sphere = blueprintEnemy.clone()
    const val = getRandom(1, 2)
    sphere.scale.set(val, val, val)

    sphere.position.y = getRandom(0, 1) > 0.5 ? 5 : 15

    this.position = sphere.position
    this.collision = false;
    this.boundingSphereRad = radiusBox*val

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