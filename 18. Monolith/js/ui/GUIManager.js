function GUIManager(gameState) {
    
    const group = new THREE.Group()
    this.group = group

    const comboLength = 5
    let comboStreak = 0
    let scoreMultiplier = 1

    let comboMesh

    const scoreTextureObj = new CanvasTexture("score: ")
    scoreTextureObj.setText(gameState.score)

    const comboTextureObj = new CanvasTexture("x ")
   comboTextureObj.setText(scoreMultiplier)

    const lifeTextureObj = new CanvasTexture("lives: ")
    lifeTextureObj.setText(gameState.lives)

    createTextures();

    function updateLives(lives) {
        lifeTextureObj.setText(lives)
    }

    function updateScore(score) {
        scoreTextureObj.setText(score)
    }

    eventBus.subscribe(decreaseLife, () => { updateLives(--gameState.lives); if(gameState.lives < 0) eventBus.post(gameOverEvent, gameState.score) } )

    eventBus.subscribe(increaseScore, () => { gameState.score += 1*scoreMultiplier; updateScore(gameState.score); comboStreak++; updateCombo() } )
    eventBus.subscribe(decreaseScore, () => { gameState.score -= 1*scoreMultiplier; updateScore(gameState.score); resetCombo() } )

    eventBus.subscribe(gameOverEvent, () => { updateLives(gameState.lives); updateScore(gameState.score); resetCombo() } )

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

        createLifeTexture()
        createScoreTexture()
        createComboTexture()

        function createLifeTexture() {
            const lifeMaterial = new THREE.MeshBasicMaterial( { map: lifeTextureObj.texture } );
            const lifeGeometry = new THREE.PlaneBufferGeometry(baseDim/lifeTextureObj.widthRatio, baseDim/lifeTextureObj.heightRatio, 1, 1);
            const lifeMesh = new THREE.Mesh(lifeGeometry, lifeMaterial);
            
            lifeMesh.rotation.y = Math.PI/1.33;        
            lifeMesh.position.set(0, .4, .6);

            group.add(lifeMesh)
        }

        function createScoreTexture() {
            const scoreMaterial = new THREE.MeshBasicMaterial( { map: scoreTextureObj.texture, transparent: true, side:  THREE.DoubleSide } );
            const scoreGeometry = new THREE.PlaneBufferGeometry(baseDim/scoreTextureObj.widthRatio, baseDim/scoreTextureObj.heightRatio, 1, 1);
            const scoreMesh = new THREE.Mesh(scoreGeometry, scoreMaterial);
            
            scoreMesh.rotation.y = Math.PI/4;
            scoreMesh.position.set(.2, .4, -.6);

            group.add(scoreMesh)
        }

        function createComboTexture() {
            const comboMaterial = new THREE.MeshBasicMaterial( { map: comboTextureObj.texture, transparent: true, side:  THREE.DoubleSide } );
            const comboGeometry = new THREE.PlaneBufferGeometry(baseDim/comboTextureObj.widthRatio, baseDim/comboTextureObj.heightRatio, 1, 1);
            comboMesh = new THREE.Mesh(comboGeometry, comboMaterial);
            
            comboMesh.rotation.y = Math.PI/4;
            comboMesh.position.set(.2, .46, -.6);
        }
    }
}