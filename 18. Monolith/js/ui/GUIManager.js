function GUIManager(lives, score) {
    
    const group = new THREE.Group()
    this.group = group

    const scoreTextureObj = new CanvasTexture("score: ")
    scoreTextureObj.setText(score);

    const lifeTextureObj = new CanvasTexture("lives: ")
    lifeTextureObj.setText(lives);

    createTextures();

    this.updateLives = function(lives) {
        lifeTextureObj.setText(lives);
    }

    function createTextures() {
        const baseDim = .2;

        const lifebarMaterial = new THREE.MeshBasicMaterial( { map: lifeTextureObj.texture } );
        const planeGeometry = new THREE.PlaneBufferGeometry(baseDim/lifeTextureObj.widthRatio, baseDim/lifeTextureObj.heightRatio, 1, 1);
        const lifebarMesh = new THREE.Mesh(planeGeometry, lifebarMaterial);
        
        lifebarMesh.rotation.y = Math.PI/1.33;        
        lifebarMesh.position.set(0, .4, .6);

        const scoreMaterial = new THREE.MeshBasicMaterial( { map: scoreTextureObj.texture, transparent: true, side:  THREE.DoubleSide } );
        const scoreGeometry = new THREE.PlaneBufferGeometry(baseDim/scoreTextureObj.widthRatio, baseDim/scoreTextureObj.heightRatio, 1, 1);
        const scoreMeshDigit1 = new THREE.Mesh(scoreGeometry, scoreMaterial);
        
        scoreMeshDigit1.rotation.y = Math.PI/4;
        scoreMeshDigit1.position.set(.2, .4, -.6);

        group.add(lifebarMesh);
        group.add(scoreMeshDigit1);
    }
}