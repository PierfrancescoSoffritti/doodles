function LaserShooter(scene, gameConstants) {

    const geometry = new THREE.SphereBufferGeometry( 4, 16, 16 )
    const material = new THREE.MeshBasicMaterial( {color: "#000"} )
    const laser1 = new THREE.Mesh( geometry, material )
    laser1.position.y = gameConstants.baseLevelHeight
    scene.add(laser1)

    var geometryCyl = new THREE.CylinderBufferGeometry( 2, 2, 200, 32 );
	var materialCyl = new THREE.MeshBasicMaterial( {color: "#FFF000", transparent: true, opacity: .6} );
    var ray = new THREE.Mesh( geometryCyl, materialCyl );
    ray.rotation.z = Math.PI/2    
    ray.position.x = 100
    laser1.add( ray );

    const laser2 = laser1.clone()
    laser2.position.y = gameConstants.secondLevelHeight
    scene.add(laser2)

    this.checkCollision = function(playerPosition) {
        const playerPolar = cartesianToPolar(playerPosition.x, playerPosition.z)
        const laser1Polar = cartesianToPolar(laser1.position.x, laser1.position.z)
        const laser2Polar = cartesianToPolar(laser2.position.x, laser2.position.z)

        // if(Math.round(playerPolar.angle*10)/10 === Math.round(laser1Polar.angle*10)/10 && playerPosition.y === laser1.position.y)
        //     console.log("collision1")
        // else if(Math.round(playerPolar.angle*10)/10 === Math.round(laser2Polar.angle*10)/10 && playerPosition.y === laser2.position.y)
        //     console.log("collision2")
    }

    this.update = function(time, center, minDistaneFromCenter) {
time = 0
        const angle1 = time *2.5
        const coords = polarToCartesian(minDistaneFromCenter, angle1)
        laser1.position.x = coords.x
        laser1.position.z = coords.y
        laser1.rotation.y = -angle1

        const angle2 = Math.PI/2 + time *2.5
        const coords2 = polarToCartesian(minDistaneFromCenter, -angle2)
        laser2.position.x = coords2.x
        laser2.position.z = coords2.y
        laser2.rotation.y = angle2
    }
}