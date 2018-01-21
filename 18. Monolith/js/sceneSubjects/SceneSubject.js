function SceneSubject(scene) {
	const self = this;

	const colors = ["#F44336", "#9C27B0", "#3F51B5", "#4CAF50"]
	
	this.group = new THREE.Group();
	this.group.position.set(0,0,0);
	scene.add(this.group);

	var geometry = new THREE.PlaneBufferGeometry(2000, 2000, 32 );
	var material = new THREE.MeshStandardMaterial({color: "#FF2C2C", shading: THREE.SmoothShading, metalness: .0, roughness: 1 });
	var plane = new THREE.Mesh( geometry, material );
	plane.rotation.x = -Math.PI/2
	this.group.add( plane );
	plane.receiveShadow = true;

	var geometry = new THREE.CylinderBufferGeometry( 5, 35, 150, 32 );
	var material = new THREE.MeshBasicMaterial( {color: "#FFF"} );
	var cylinder = new THREE.Mesh( geometry, material );
	this.group.add( cylinder );
	cylinder.castShadow = true;

	var geometry = new THREE.BoxBufferGeometry( 40, 25, 40 );
	var material = new THREE.MeshBasicMaterial( {color: "#FFF"} );
	var cube = new THREE.Mesh( geometry, material );
	this.group.add( cube );
	cube.castShadow = true;

	for(let i=0; i<20; i++)
		placePillar(this.group, 210, 300)

	function placePillar(group, radiusMin, radiusMax) {
		const radius = getRandom(radiusMin, radiusMax)
		const angle = getRandom(0, Math.PI*2)
		const color = colors[getRandomInt(0, colors.length)]

		const x = radius * cos(angle)
        const y = 0
        const z = radius * sin(angle)
	
		var geometry = new THREE.BoxBufferGeometry( getRandomInt(5,30), getRandomInt(5,50), getRandomInt(5,30) );
		var material = new THREE.MeshBasicMaterial( {color: color} );
		var pillar = new THREE.Mesh( geometry, material );

		pillar.position.set(x, y, z)
		group.add(pillar)
	}

	
	this.update = function(time) {
	}
}