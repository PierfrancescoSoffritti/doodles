function Player(scene, gameState, shooter) {
    const self = this

    const group = new THREE.Group()
    scene.add( group )

    const guiManager = new GUIManager();
    group.add(guiManager.group);

    const colors = [ "#F44336", "#3F51B5", "#2196F3", "#009688", "#4CAF50", "#8BC34A", "#CDDC39", "#FFC107", "#FF9800", "#FF5722" ]
    const color = colors[ getRandomInt(0, colors.length) ]
    
    shooter.bulletsColor = tinycolor(color).darken(20).toString()

    var loader = new THREE.JSONLoader();
    loader.load('models/spaceship.json', function(geometry, materials) {

        self.materials = materials;
        
        for(let i=0; i<materials.length; i++) {
            materials[i].flatShading = true
            materials[i].shininess = 0 
            materials[i].metalness = 0 
            materials[i].roughness = 0.4

            materials[i].transparent = true
            
            if(materials[i].name === "engine") {
                materials[i].emissive = new THREE.Color("#B71C1C")
                materials[i].emissiveIntensity = 0
            }

            changeColors(color, materials[i])
        }

        const mesh = new THREE.Mesh(geometry, materials);
        const scale = .2
        mesh.scale.set(scale, scale, scale)
        group.add(mesh);

        const pointLight = new THREE.PointLight( "#E8E8E8", .3, 20);
        pointLight.position.set( 1, 1, 0 );
        group.add( pointLight );

        self.mesh = mesh
	});
    
    this.position = group.position
    this.rotation = group.rotation

    this.acceleration = 0
    this.shoot = false

    let recoveringFromDamage = false;
    
    this.update = function(time) {
        if(this.shoot === true)
            shoot()
        
        updateEngineColor(this.acceleration)    
        fadeMesh(time);
    }

    this.takeDamage = function() {
        if(recoveringFromDamage)
            return;

        eventBus.post(decreaseLife)
        recoveringFromDamage = true;
        setTimeout(() => recoveringFromDamage = false, 3000);
    }

    function fadeMesh(time) {
        const opacity = recoveringFromDamage ? 
            ( sin(time*16) +1.2 ) / 2.2
            : 1;

        for(let i=0; i<self.materials.length; i++)
            self.materials[i].opacity = opacity;
    }

    function shoot() {
        shooter.shoot( new THREE.Vector3(group.position.x, group.position.y-1, group.position.z) )
        eventBus.post(playerShoot)
    }

    function updateEngineColor(acceleration) {

        self.engineMaterial.emissiveIntensity = acceleration
    }

    function changeColors(color, material) {
        if(material.name === "white")
            material.color = new THREE.Color( tinycolor(color).lighten(30).toString() )
        else if(material.name === "blue")
            material.color = new THREE.Color( tinycolor(color).darken(25).toString() )
        else if(material.name === "black")
            material.color = new THREE.Color( tinycolor(color).darken(55).toString() )
        else if(material.name === "engine") {
            material.color = new THREE.Color("#000")

            self.engineMaterial = material
        }
    }
}