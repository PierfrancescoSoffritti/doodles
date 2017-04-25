function Mirrors(scene, player, collisionManager, terrainSize, cubeCamera) {

	const material = new THREE.MeshBasicMaterial({color:"#fff", side: THREE.DoubleSide, shading: THREE.FlatShading})
	material.envMap = cubeCamera.renderTarget.texture;

	const square = new THREE.Mesh(new THREE.CircleBufferGeometry(20, 4), material);
	const circle = new THREE.Mesh(new THREE.CircleBufferGeometry(20, 16), material);

	const mirrors = []

	for(let i=0; i<5; i++) {
		const xOffset = getRandom(-terrainSize/6, terrainSize/16);
		const zOffset = getRandom(-terrainSize/4, terrainSize/16);

		const mesh = Math.random() > 0.5 ? square.clone() : circle.clone();		
		mesh.rotation.y = getRandom(0, Math.PI*2);
		mesh.position.set(xOffset, -1, zOffset);
		mesh.scaleFactor = getRandom(.2, 1.5);
		mesh.scale.multiplyScalar(mesh.scaleFactor);
		mirrors.push(mesh)
		scene.add(mesh);
	}

	this.update = function(time) {
		for(let i=0; i<mirrors.length; i++) {
			
			const mesh = mirrors[i];

			// update Y
			if(mesh.position.y < 0) {
				const y = collisionManager.getY(mesh.position.x, mesh.position.z);
				if(y !== null) {
					mesh.position.y = y + 20*mesh.scaleFactor;
				}
			}

			const scale = (Math.sin(time)+4)/5 * mesh.scaleFactor;
			mesh.scale.set(scale, scale, scale);
		}
	}
}