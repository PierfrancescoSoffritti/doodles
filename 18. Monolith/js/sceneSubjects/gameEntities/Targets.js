function Targets(scene, gameConstants) {

    const numberOfTargetsPerLevel = 12
    const angleStep = (Math.PI*2) / numberOfTargetsPerLevel

    const targets = []

    createTargets()

    function createTargets() {
        
        const rad = gameConstants.monolithRadius
        let angle = 0

        for(let i=0; i<numberOfTargetsPerLevel; i++) {
            const position = polarToCartesian(rad, angle)            
            const target = new Target( scene, new THREE.Vector3(position.x, gameConstants.lowLevelTargetsHeight, position.y), angle )            
            targets.push(target)

            angle += angleStep
        }

        angle = 0
        for(let i=0; i<numberOfTargetsPerLevel; i++) {
            const position = polarToCartesian(rad, angle)            
            const target = new Target( scene, new THREE.Vector3(position.x, gameConstants.highLevelTargetsHeight, position.y), angle )            
            targets.push(target)

            angle += angleStep
        }
    }

    this.update = function(time) {
        for(let i=0; i<targets.length; i++)
            targets[i].update(time)
    }

}

function Target(scene, position, rotationY) {
    const geometry = new THREE.BoxBufferGeometry( 1, 4, 2 )
    const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} )
    const cube = new THREE.Mesh( geometry, material )
    scene.add( cube )

    const speed = getRandom(1, 4)

    cube.position.set(position.x, position.y, position.z)
    cube.rotation.y = -rotationY

    this.update = function(time) {
        cube.position.y += sin(time*speed)/100
    }
}