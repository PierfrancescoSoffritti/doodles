const enemyRadius = 4
const enemyGeometry = new THREE.SphereBufferGeometry( enemyRadius, 16, 16 );
const enemyMaterial = new THREE.MeshBasicMaterial( {color: "#00FFFF"} );
const enemyBlueprint = new THREE.Mesh( enemyGeometry, enemyMaterial );

function Enemy(scene, { minRadius, maxRadius, baseLevelHeight, secondLevelHeight }, origin) {
    
    const sphere = enemyBlueprint.clone()
    scene.add(sphere)

    const scale = getRandom(1, 2)
    sphere.scale.set(scale, scale, scale)
    sphere.position.y = origin.y

    const speed = 1

    const polarCoordinates = cartesianToPolar(origin.x, origin.z)

    this.position = sphere.position
    this.collision = false
    this.boundingSphereRad = enemyRadius*scale

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