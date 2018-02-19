function GUIManager(lives = 6, score = 0) {
    
    const group = new THREE.Group()
    this.group = group

    const comboLength = 5
    let comboStreak = 0
    let scoreMultiplier = 1

    let comboMesh

    const scoreTextureObj = new CanvasTexture("score: ")
    scoreTextureObj.setText(score)

    const comboTextureObj = new CanvasTexture("x ")
   comboTextureObj.setText(scoreMultiplier)

    const lifeTextureObj = new CanvasTexture("lives: ")
    lifeTextureObj.setText(lives)

    createTextures();

    function updateLives(lives) {
        lifeTextureObj.setText(lives)
    }

    function updateScore(score) {
        scoreTextureObj.setText(score)
    }

    eventBus.subscribe(decreaseLife, () => updateLives(--lives) )

    eventBus.subscribe(increaseScore, () => { score += 1*scoreMultiplier; updateScore(score); comboStreak++; updateCombo() } )
    eventBus.subscribe(decreaseScore, () => { score -= 1*scoreMultiplier; updateScore(score); resetCombo() } )

    function updateCombo() {
        if(comboStreak % comboLength != 0)
            return

        scoreMultiplier++
        comboTextureObj.setText(scoreMultiplier)

        group.add(comboMesh)
    }

    function resetCombo() {
        comboStreak = 0
        scoreMultiplier = 1
        group.remove(comboMesh)
    }

    function createTextures() {
        const baseDim = .2;

        const lifebarMaterial = new THREE.MeshBasicMaterial( { map: lifeTextureObj.texture } );
        const planeGeometry = new THREE.PlaneBufferGeometry(baseDim/lifeTextureObj.widthRatio, baseDim/lifeTextureObj.heightRatio, 1, 1);
        const lifebarMesh = new THREE.Mesh(planeGeometry, lifebarMaterial);
        
        lifebarMesh.rotation.y = Math.PI/1.33;        
        lifebarMesh.position.set(0, .4, .6);

        // ---

        const scoreMaterial = new THREE.MeshBasicMaterial( { map: scoreTextureObj.texture, transparent: true, side:  THREE.DoubleSide } );
        const scoreGeometry = new THREE.PlaneBufferGeometry(baseDim/scoreTextureObj.widthRatio, baseDim/scoreTextureObj.heightRatio, 1, 1);
        const scoreMesh = new THREE.Mesh(scoreGeometry, scoreMaterial);
        
        scoreMesh.rotation.y = Math.PI/4;
        scoreMesh.position.set(.2, .4, -.6);

        // ---

        const comboMaterial = new THREE.MeshBasicMaterial( { map: comboTextureObj.texture, transparent: true, side:  THREE.DoubleSide } );
        const comboGeometry = new THREE.PlaneBufferGeometry(baseDim/comboTextureObj.widthRatio, baseDim/comboTextureObj.heightRatio, 1, 1);
        comboMesh = new THREE.Mesh(comboGeometry, comboMaterial);
        
        comboMesh.rotation.y = Math.PI/4;
        comboMesh.position.set(.2, .46, -.6);

        group.add(lifebarMesh);
        group.add(scoreMesh);
    }
}