function Turrets(scene, gameConstants, gameState) {

    const numberOfTargetsPerLevel = 20
    const angleStep = (Math.PI*2) / numberOfTargetsPerLevel

    const targetsLow = []
    const targetsHigh = []

    createTurrets(targetsLow, gameConstants.turretsHeight)
    // createTargets(targetsHigh, gameConstants.highLevelTargetsHeight)

    this.update = function(time) {
        for(let i=0; i<numberOfTargetsPerLevel; i++) {
            const target = targetsLow[i]
            target.update(time)
            // targetsHigh[i].update(time)

            const playerAngle = cartesianToPolar(gameState.playerPosition.x, gameState.playerPosition.z).angle
            if(playerAngle >= target.angle - target.angleStep/2 && playerAngle <= target.angle + target.angleStep/2 ) {
                const i1 = i-1 < 0 ? numberOfTargetsPerLevel-1 : i-1

                targetsLow[ (i1) % numberOfTargetsPerLevel ].shoot(gameState.playerPosition)
                target.shoot(gameState.playerPosition)
                targetsLow[ (i+1) % numberOfTargetsPerLevel ].shoot(gameState.playerPosition)
                
                gameState.currentTargetPosition = target.position
            }
        }
    }

    this.getBullets = function() {
        let bullets = []

        for(let i=0; i<targetsLow.length; i++) 
            bullets = bullets.concat( targetsLow[i].getBullets() )
        
        return bullets
    }

    function createTurrets(targets, height) {
        
        const rad = gameConstants.monolithRadius
        let angle = 0

        for(let i=0; i<numberOfTargetsPerLevel; i++) {
            const position = polarToCartesian(rad, angle)            
            const target = new Turret( scene, gameConstants, gameState, new THREE.Vector3(position.x, height, position.y), angle, angleStep)            
            targets.push(target)

            angle += angleStep
        }
    }

}

function Turret(scene, gameConstants, gameState, position, angle, angleStep) {
    const geometry = new THREE.BoxBufferGeometry( 1, 4, 2 )
    const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} )
    const cube = new THREE.Mesh( geometry, material )
    scene.add( cube )

    this.position = cube.position

    this.angle = angle
    this.angleStep = angleStep

    const speed = getRandom(1, 4)

    cube.position.set(position.x, position.y-2, position.z)
    cube.rotation.y = -angle

    const shooter = new EnemyBulletsShooter(scene, cube.position, gameConstants)

    this.update = function(time) {
        cube.position.y += sin(time*speed)/100
        shooter.update(time)
    }

    this.shoot = function(targetPosition) {
        shooter.shoot(targetPosition)
    }

    this.getBullets = function () {
        return shooter.bullets
    }
}