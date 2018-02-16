function Player(scene, gameState, shooter) {
    const self = this

    let lives = 6;
    let score = 0;

    const group = new THREE.Group()
    scene.add( group )

    const guiManager = new GUIManager(lives, score);
    group.add(guiManager.group);

    var loader = new THREE.JSONLoader();
    loader.load('models/spaceship_merged.json', function(geometry, materials) {

        self.materials = materials;
        
        for(let i=0; i<materials.length; i++) {
            materials[i].flatShading = true
            materials[i].shininess = 0 
            materials[i].transparent = true;
            
            changeColors(materials[i])
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

        lives = lives-1;
        guiManager.updateLives(lives);

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
        self.engineMaterial.color.r = self.engineBaseColor.r + acceleration*4
        self.engineMaterial.color.g = self.engineBaseColor.g + acceleration
        self.engineMaterial.color.b = self.engineBaseColor.b + acceleration
    }

    function changeColors(material) {
        if(material.name === "white") {
            material.color.r = getRandom(.3, 1)
            material.color.g = getRandom(.3, 1)
            material.color.b = getRandom(.3, 1)
        } else if(material.name === "blue") {
            material.color.r = getRandom(0, .3)
            material.color.g = getRandom(0, .3)
            material.color.b = getRandom(0, .3)
        } else if(material.name === "black") {
            material.color.r = getRandom(0, .3)
            material.color.g = getRandom(0, .3)
            material.color.b = getRandom(0, .3)
        } else if(material.name === "engine") {
            material.color.r = getRandom(0, .2)
            material.color.g = getRandom(0, .2)
            material.color.b = getRandom(0, .2)

            self.engineMaterial = material
            self.engineBaseColor = material.color.clone()
        }
    }
}