function Player(scene, shooter) {
    const self = this

    const group = new THREE.Group()
    scene.add( group )

    // const geometry = new THREE.BoxBufferGeometry( .5, .5, .8 )
	// const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} )
	// const cube = new THREE.Mesh( geometry, material )
    // cube.castShadow = true
    // group.add(cube)

    var loader = new THREE.JSONLoader();
    loader.load('models/spaceship_merged.json', function(geometry, materials) {
        // const material = new THREE.MeshFaceMaterial(materials)
        // material.shading = THREE.FlatShading
        for(let i=0; i<materials.length; i++)
            materials[i].shading = THREE.FlatShading

        const mesh = new THREE.Mesh(geometry, materials);
        const scale = .2
        mesh.scale.set(scale, scale, scale)
        group.add(mesh);

        const pointLight = new THREE.PointLight( "#E8E8E8", .3, 20);
        pointLight.position.set( 1, 1, 0 );
        group.add( pointLight );

        var sphereSize = 10;
        var pointLightHelper = new THREE.PointLightHelper( pointLight, sphereSize );
        group.add( pointLightHelper );

        self.mesh = mesh
	});
    
    // this.mesh = cube
    this.position = group.position
    this.rotation = group.rotation
    
    this.update = function(time) {
        shooter.update(time)
    }

    this.shoot = function() {
        shooter.shoot(new THREE.Vector3(group.position.x, group.position.y-1, group.position.z))
    }
}