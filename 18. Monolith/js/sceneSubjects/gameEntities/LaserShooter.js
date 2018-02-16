function LaserShooter(scene, gameConstants) {

    const laserBlueprint = new THREE.Group()

    const geometrySphere = new THREE.SphereBufferGeometry( 2, 16, 16 )
    const materialSphere = new THREE.MeshBasicMaterial( {color: "#000"} )
    const laserSphereMesh = new THREE.Mesh( geometrySphere, materialSphere )
    laserBlueprint.add(laserSphereMesh)

    var geometryCyl = new THREE.CylinderBufferGeometry( 1, 1, 200, 32 );
	var materialCyl = new THREE.MeshBasicMaterial( {color: "#FFF000", transparent: true, opacity: .6} );
    var rayMesh = new THREE.Mesh( geometryCyl, materialCyl );
    rayMesh.rotation.z = Math.PI/2    
    rayMesh.position.x = 100
    laserBlueprint.add( rayMesh );

    const laser1 = laserBlueprint.clone()
    const laser2 = laserBlueprint.clone()
    laser1.position.y = gameConstants.baseLevelHeight
    laser2.position.y = gameConstants.secondLevelHeight

    soundSphere = laserSphereMesh.clone();
    soundSphere2 = laserSphereMesh.clone();
    scene.add(soundSphere)
    scene.add(soundSphere2)
    objTT = soundSphere
    objTT2 = soundSphere2

    scene.add(laser1)
    scene.add(laser2)

    laser1PolarPosition = {
        radius: 0,
        angle: 0
    }

    laser2PolarPosition = {
        radius: 0,
        angle: 0
    }

    const collisionOffset = 6

    this.checkCollision = function(playerPosition) {
        const playerPolar = cartesianToPolar(playerPosition.x, playerPosition.z)
        const collisionPointLaser1 = polarToCartesian(playerPolar.radius, laser1PolarPosition.angle)
        const collisionPointLaser2 = polarToCartesian(playerPolar.radius, laser2PolarPosition.angle)

        const distance1 = Math.sqrt( (Math.pow(playerPosition.x - collisionPointLaser1.x, 2) ) + (Math.pow(playerPosition.z - collisionPointLaser1.y, 2) )  )
        const distance2 = Math.sqrt( (Math.pow(playerPosition.x - collisionPointLaser2.x, 2) ) + (Math.pow(playerPosition.z - collisionPointLaser2.y, 2) )  )

        soundSphere.position.set(collisionPointLaser1.x, laser1.position.y, collisionPointLaser1.y)
        soundSphere2.position.set(collisionPointLaser2.x, laser2.position.y, collisionPointLaser2.y)
        
        // laser 1
        if(distance1 < collisionOffset && ( playerPosition.y >= gameConstants.baseLevelHeight && playerPosition.y <= gameConstants.baseLevelHeight+collisionOffset ) )
            return true;

        // laser 2
        if(distance2 < collisionOffset && ( playerPosition.y <= gameConstants.secondLevelHeight && playerPosition.y >= gameConstants.secondLevelHeight-collisionOffset ))
            return true;
    }

    this.update = function(time, center, minDistaneFromCenter) {
        const speedLaser1 = 2.8;
        const angle1 = time *speedLaser1
        const coords = polarToCartesian(minDistaneFromCenter, angle1)
        laser1.position.x = coords.x
        laser1.position.z = coords.y
        laser1.rotation.y = -angle1

        const speedLaser2 = 3.2;
        const angle2 = Math.PI/2 + time *speedLaser2
        const coords2 = polarToCartesian(minDistaneFromCenter, -angle2)
        laser2.position.x = coords2.x
        laser2.position.z = coords2.y
        laser2.rotation.y = angle2

        laser1PolarPosition.radius = minDistaneFromCenter
        laser2PolarPosition.radius = minDistaneFromCenter

        laser1PolarPosition.angle = angle1
        laser2PolarPosition.angle = -angle2
    }
}