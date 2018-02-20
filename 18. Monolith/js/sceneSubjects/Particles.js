function Particles(scene, gameConstants) {
    
    const particlesGeometry = new THREE.Geometry();
    const range = gameConstants.maxRadius*2;
    
    for (let i = 0; i < 100; i++) {        
        const vertex = new THREE.Vector3();
        
        vertex.baseCoords = new THREE.Vector3(
        	getRandom(-range/2, range/2),
        	getRandom(5, 100),
            getRandom(-range/2, range/2)
        )
        
        vertex.x = vertex.baseCoords.x;
        vertex.y = vertex.baseCoords.y;
        vertex.z = vertex.baseCoords.z;

        vertex.speedX = getRandom(-0.2, 0.2);
        vertex.speedY = getRandom(-0.2, 0.2);
        vertex.speedZ = getRandom(-0.2, 0.2);

        particlesGeometry.vertices.push(vertex);
    }

    const textureLoader = new THREE.TextureLoader();
	const texture = textureLoader.load("textures/particle.png");

	const particleMaterial = new THREE.PointsMaterial({ map: texture, color: "#fff", size: .4, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7, alphaTest: 0.25 });
    const particlePointsCloud = new THREE.Points(particlesGeometry, particleMaterial);
    
    scene.add(particlePointsCloud)
	
	this.update = function(time) {
		for(let i=0; i<particlesGeometry.vertices.length; i++) {
            const vertex = particlesGeometry.vertices[i];
            
            vertex.x = vertex.baseCoords.x + sin(time * vertex.speedX) *10
            vertex.y = vertex.baseCoords.y + sin(time * vertex.speedY) *10
            vertex.z = vertex.baseCoords.z + sin(time * vertex.speedZ) *10
		}
		particlesGeometry.verticesNeedUpdate = true;
	}
}