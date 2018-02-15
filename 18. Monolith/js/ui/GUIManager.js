function GUIManager() {
    
    const group = new THREE.Group()
    this.group = group

    const scoreTextureObj = new ScoreTexture()

    loadTexture();

    function loadTexture() {
        const baseDim = .3;

        const lifebarTexture = new THREE.Texture(scoreTextureObj.canvas);
        lifebarTexture.needsUpdate = true;
        const lifebarMaterial = new THREE.MeshBasicMaterial( { map: lifebarTexture } );
        const planeGeometry = new THREE.PlaneBufferGeometry(baseDim/scoreTextureObj.widthRatio, baseDim/scoreTextureObj.heightRatio, 1, 1);
        const lifebarMesh = new THREE.Mesh(planeGeometry, lifebarMaterial);
        
        lifebarMesh.rotation.y = Math.PI/1.33;        
        lifebarMesh.position.set(0, .4, .6);

        const scoreTexture = new THREE.Texture(scoreTextureObj.canvas);
        scoreTexture.needsUpdate = true;

        const scoreMaterial = new THREE.MeshBasicMaterial( { map: scoreTexture, transparent: true, side:  THREE.DoubleSide } );
        const scoreGeometry = new THREE.PlaneBufferGeometry(baseDim/scoreTextureObj.widthRatio, baseDim/scoreTextureObj.heightRatio, 1, 1);
        const scoreMeshDigit1 = new THREE.Mesh(scoreGeometry, scoreMaterial);
        
        scoreMeshDigit1.rotation.y = Math.PI/4;
        scoreMeshDigit1.position.set(.2, .4, -.6);

        group.add(lifebarMesh);
        group.add(scoreMeshDigit1);
    }
}