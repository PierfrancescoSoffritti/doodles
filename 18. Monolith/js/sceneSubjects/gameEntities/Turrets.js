function Turrets(scene, gameConstants, gameState) {

    const numberOfTargetsPerLevel = 20
    const angleStep = (Math.PI*2) / numberOfTargetsPerLevel

    const targetsLow = []
    const targetsHigh = []

    let lastShootForwardTime = 0
    let shootForwardDelay = 10
    const shootForwardDurationConst = 6
    let shootForwardDuration = shootForwardDurationConst

    createTurrets(targetsLow, gameConstants.turretsHeight)

    this.update = function(time) {
        for(let i=0; i<numberOfTargetsPerLevel; i++) {
            const target = targetsLow[i]
            target.update(time)

            target.material.color.r = ( (time - lastShootForwardTime) / shootForwardDelay)
            target.mesh.scale.y = ( (time - lastShootForwardTime) / shootForwardDelay)*2 +1

            if(time > lastShootForwardTime + shootForwardDelay) {
                target.shootForward(gameState.playerPosition)
                shootForwardDuration -= 0.01;

                target.mesh.scale.y = 1
                target.material.color.r = 0
                
                if(shootForwardDuration <= 0) {
                    lastShootForwardTime = time
                    shootForwardDelay = getRandom(10, 20)
                    shootForwardDuration = shootForwardDurationConst
                }

            } else {            
                const playerAngle = cartesianToPolar(gameState.playerPosition.x, gameState.playerPosition.z).angle
                if(playerAngle >= target.angle - target.angleStep/2 && playerAngle <= target.angle + target.angleStep/2 ) {
                    const i1 = i-1 < 0 ? numberOfTargetsPerLevel-1 : i-1

                    // targetsLow[ (i1) % numberOfTargetsPerLevel ].shoot(gameState.playerPosition)
                    target.shoot(gameState.playerPosition)
                    targetsLow[ (i+1) % numberOfTargetsPerLevel ].shoot(gameState.playerPosition)
                    
                    gameState.currentTargetPosition = target.position
                }
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
    const material = new THREE.MeshBasicMaterial( {color: 0xFF0000} )
    const cube = new THREE.Mesh( geometry, material )
    scene.add( cube )

    this.material = material
    this.mesh = cube

    this.position = cube.position

    this.angle = angle
    this.angleStep = angleStep

    const speed = getRandom(1, 4)

    cube.position.set(position.x, position.y-2, position.z)
    cube.rotation.y = -angle

    const shooter = new TurretBulletsShooter(scene, cube.position, gameConstants)

    this.update = function(time) {
        cube.position.y += sin(time*speed)/100
        shooter.update(time)
    }

    this.shoot = function(targetPosition) {
        shooter.shoot(targetPosition)
    }

    this.shootForward = function(targetPosition) {
        const polar = cartesianToPolar(cube.position.x, cube.position.z)
        const cartesian = polarToCartesian(gameConstants.maxRadius, polar.angle)
        shooter.shoot(new THREE.Vector3(cartesian.x, targetPosition.y, cartesian.y), 3)
    }

    this.getBullets = function () {
        return shooter.bullets
    }
}