function Targets(scene, gameConstants, gameState) {

    const numberOfTargetsPerLevel = 8
    const angleStep = (Math.PI*2) / numberOfTargetsPerLevel

    const targetsLow = []
    const targetsHigh = []

    createTargets(targetsLow, gameConstants.targetsHeight)
    // createTargets(targetsHigh, gameConstants.highLevelTargetsHeight)

    function createTargets(targets, height) {
        
        const rad = gameConstants.monolithRadius
        let angle = 0

        for(let i=0; i<numberOfTargetsPerLevel; i++) {
            const position = polarToCartesian(rad, angle)            
            const target = new Target( scene, gameConstants, gameState, new THREE.Vector3(position.x, height, position.y), angle, angleStep)            
            targets.push(target)

            angle += angleStep
        }
    }

    this.update = function(time) {
        for(let i=0; i<numberOfTargetsPerLevel; i++) {
            targetsLow[i].update(time)
            // targetsHigh[i].update(time)
        }
    }

}

function Target(scene, gameConstants, gameState, position, angle, angleStep) {
    const geometry = new THREE.BoxBufferGeometry( 1, 4, 2 )
    const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} )
    const cube = new THREE.Mesh( geometry, material )
    scene.add( cube )

    const speed = getRandom(1, 4)

    cube.position.set(position.x, position.y-2, position.z)
    cube.rotation.y = -angle

    const shooter = new EnemyShooter(scene, cube.position, gameConstants)

    this.update = function(time) {
        cube.position.y += sin(time*speed)/100

        const playerAngle = cartesianToPolar(gameState.playerPosition.x, gameState.playerPosition.z).angle
        if(playerAngle >= angle - angleStep/2 && playerAngle <= angle + angleStep/2 ) {
            // shooter.shoot(gameState.playerPosition)
        }

        shooter.update(time)
    }
}