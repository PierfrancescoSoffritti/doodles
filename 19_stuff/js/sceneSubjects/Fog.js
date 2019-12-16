function Fog(scene) {

    const textureLoader = new THREE.TextureLoader();
    const mainTexture = textureLoader.load("textures/fog1.jpg");
    mainTexture.wrapS = THREE.RepeatWrapping; 
    mainTexture.wrapT = THREE.RepeatWrapping;

    const secTexture = textureLoader.load("textures/fog.jpg");
    secTexture.wrapS = THREE.RepeatWrapping; 
    secTexture.wrapT = THREE.RepeatWrapping;
    
    const mainPlane = new THREE.Mesh(
		new THREE.PlaneGeometry(8, 6, 1), 
		new THREE.MeshStandardMaterial({
            color: "#ff0000",
            //  map: texture, 
             alphaMap: mainTexture,
             transparent: true,
             fog: false
            //  side: THREE.DoubleSide
             })
    )

    const secPlane = new THREE.Mesh(
		new THREE.PlaneGeometry(8, 6, 1), 
		new THREE.MeshStandardMaterial({
            color: "#ff0000",
            //  map: texture, 
             alphaMap: secTexture,
             transparent: true,
             fog: false
            //  side: THREE.DoubleSide
        })
    )

    const mainGroup = new THREE.Group()
    for (let i=-5; i<= 5; i++) {
        const p = mainPlane.clone()
        p.position.set(i*8, 1, -10)
        mainGroup.add(p)
    }

    const secGroup = new THREE.Group()
    for (let i=-5; i<= 5; i++) {
        const p = secPlane.clone()
        p.position.set(i*8, 2, -10)
        secGroup.add(p)
    }

    scene.add(secGroup)
    scene.add(mainGroup)

	this.update = function(time) {
        secGroup.position.x += 0.006
        mainGroup.position.x += 0.002
	}
}