const enemyRadius = 2
const enemyGeometry = new THREE.SphereBufferGeometry( enemyRadius, 16, 16 );
const enemyMaterial = new THREE.MeshStandardMaterial({ color: "#F44336", roughness: 0, metalness: .9  });

const envMap = new THREE.TextureLoader().load('textures/envMap.png');
envMap.mapping = THREE.SphericalReflectionMapping;
enemyMaterial.envMap = envMap;

const enemyBlueprint = new THREE.Mesh( enemyGeometry, enemyMaterial );

// wireframe
const wireMaterial = new THREE.MeshPhongMaterial({ color: "#4CAF50", flatShading: true, wireframe: true });
const wireframeGeo = new THREE.IcosahedronBufferGeometry(enemyRadius, 1)
const wireframeMesh = new THREE.Mesh(wireframeGeo, wireMaterial)
wireframeMesh.scale.set(1.3, 1.3, 1.3)
enemyBlueprint.add(wireframeMesh)

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
    this.boundingSphereRad = enemyRadius*scale *2

    this.update = function(time) {

        wireMaterial.color.setHSL( Math.abs( Math.sin(time)) , 0.9, 0.5 );

        polarCoordinates.radius += speed

        sphere.position.x = polarCoordinates.radius * cos(polarCoordinates.angle)
        sphere.position.z = polarCoordinates.radius * sin(polarCoordinates.angle)

        sphere.rotation.x ++;

        const expired = ( polarCoordinates.radius > maxRadius || this.collision === true ) ? true : false

        if(expired) {
            const tween = new TWEEN.Tween(sphere.scale)
                .to({ x: 0, y: 0, z: 0 } , 200)
                .easing(TWEEN.Easing.Cubic.InOut)
                .onComplete(function() {                
                    scene.remove(sphere)
                })
                .start();
        }
            
        return expired
    }

    this.destroy = function() {
        scene.remove(sphere)
    }
}