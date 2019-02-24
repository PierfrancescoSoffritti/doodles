const targetRadius = 2

const targetGeometry = new THREE.SphereBufferGeometry( targetRadius, 16, 16 );
const targetMaterial = new THREE.MeshStandardMaterial({ color: "#F44336", roughness: 0, metalness: .9  });
const targetBlueprint = new THREE.Mesh( targetGeometry, targetMaterial );

const envMap = new THREE.TextureLoader().load('textures/envMap.png');
envMap.mapping = THREE.SphericalReflectionMapping;
targetMaterial.envMap = envMap;

const targetWirefraneMaterial = new THREE.MeshPhongMaterial({ color: "#4CAF50", flatShading: true, wireframe: true });
const targetWireframeGeometry = new THREE.IcosahedronBufferGeometry(targetRadius, 1)
const targetWireframeMesh = new THREE.Mesh(targetWireframeGeometry, targetWirefraneMaterial)
targetWireframeMesh.scale.set(1.3, 1.3, 1.3)
targetBlueprint.add(targetWireframeMesh)

function Target(scene, { minRadius, maxRadius, baseLevelHeight, secondLevelHeight }, origin) {
    
    const sphere = targetBlueprint.clone()
    scene.add(sphere)

    const scale = getRandom(1, 2)
    sphere.scale.set(scale, scale, scale)
    sphere.position.y = origin.y

    const speed = 1

    const polarCoordinates = cartesianToPolar(origin.x, origin.z)

    let removing = false
    let removed = false

    this.collision = false
    this.position = sphere.position
    this.boundingSphereRad = targetRadius*scale *2

    this.update = function(time) {

        targetWirefraneMaterial.color.setHSL( Math.abs( Math.sin(time)) , 0.9, 0.5 );

        polarCoordinates.radius += speed

        sphere.position.x = polarCoordinates.radius * cos(polarCoordinates.angle)
        sphere.position.z = polarCoordinates.radius * sin(polarCoordinates.angle)

        sphere.rotation.x ++;

        const expired = ( polarCoordinates.radius > maxRadius || this.collision === true ) ? true : false

        if(expired)
            removeObject()
        
        return removed
    }
    
    this.reset = function(newOrigin) {
        sphere.scale.set(scale, scale, scale)
       
        sphere.position.y = newOrigin.y       
        const newOriginCoords = cartesianToPolar(newOrigin.x, newOrigin.z)
        polarCoordinates.radius = newOriginCoords.radius
        polarCoordinates.angle = newOriginCoords.angle

        removing = false
        removed = false
        this.collision = false

        scene.add(sphere)

        return this
    }

    this.destroy = function() {
        scene.remove(sphere)
    }

    function removeObject() {
        if(removing)
            return

        removing = true

        const tween = new TWEEN.Tween(sphere.scale)
            .to({ x: 0, y: 0, z: 0 } , 200)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onComplete( () => { scene.remove(sphere); removed = true; } )
            .start()
    }
}