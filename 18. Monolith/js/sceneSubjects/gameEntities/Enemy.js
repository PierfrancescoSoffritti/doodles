const radiusBox = 4
const enemyGeometry = new THREE.SphereBufferGeometry( radiusBox, 16, 16 );
const enemyMaterial = new THREE.MeshBasicMaterial( {color: "#00FFFF"} );
const blueprintEnemy = new THREE.Mesh( enemyGeometry, enemyMaterial );

function Enemy(scene, { minRadius, maxRadius, baseLevelHeight, secondLevelHeight }, origin) {
    const sphere = blueprintEnemy.clone()
    const scale = getRandom(1, 2)
    sphere.scale.set(scale, scale, scale)

    // sphere.position.y = getRandom(0, 1) > 0.5 ? baseLevelHeight : secondLevelHeight
    sphere.position.y = origin.y

    this.position = sphere.position
    this.collision = false;
    this.boundingSphereRad = radiusBox*scale

    const speed = 1;
    scene.add(sphere);

    const polarCoordinates = cartesianToPolar(origin.x, origin.z)
    // let radius = 20
    // let angle = getRandom(0, Math.PI*2)

    this.update = function(time) {
        polarCoordinates.radius += speed

        sphere.position.x = polarCoordinates.radius * cos(polarCoordinates.angle)
        sphere.position.z = polarCoordinates.radius * sin(polarCoordinates.angle)

        const expired = ( polarCoordinates.radius > maxRadius || this.collision === true ) ? true : false

        if(expired)
            scene.remove(sphere)
            
        return expired
    }
}