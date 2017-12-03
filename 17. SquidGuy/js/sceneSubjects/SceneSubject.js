function SceneSubject(scene) {
	const self = this;
	
	this.group = new THREE.Group();
	this.group.position.set(0,0,-5);
	scene.add(this.group);

	const squidz = new Array();

	const squidGuy = new SquidGuy();
	this.group.add(squidGuy.group);
	squidz.push(squidGuy);

	const squidGuy2 = new SquidGuy();
	squidGuy2.group.scale.set(.5, .5, .5);
	squidGuy2.positionX = -1;
	this.group.add(squidGuy2.group);
	squidz.push(squidGuy2);

	const squidGuy3 = new SquidGuy();
	squidGuy3.group.scale.set(.5, .5, .5);
	squidGuy3.positionX = 1;
	this.group.add(squidGuy3.group);
	squidz.push(squidGuy3);

	const squidGuy4 = new SquidGuy();
	squidGuy4.group.scale.set(.5, .5, .5);
	squidGuy4.positionX = .8;
	squidGuy4.positionZ = -2;
	this.group.add(squidGuy4.group);
	squidz.push(squidGuy4);

	const squidGuy5 = new SquidGuy();
	squidGuy5.group.scale.set(.5, .5, .5);
	squidGuy5.positionX = -.8;
	squidGuy5.positionZ = -2;
	this.group.add(squidGuy5.group);
	squidz.push(squidGuy5);
	
	this.update = function(time) {
		squidz.forEach( squid => squid.update(time) );
	}

	function SquidGuy() {
		const squid = new THREE.Group();
		this.group = squid;
		
		this.positionX = 0;
		this.positionZ = 0;

		let body = null;
		const legsArray = new Array();
		
		loadOBJ(squid);
		const eyeGroup = buildEyes(squid)
		const legsGroup = buildLegs(squid)
	
		this.update = function(time) {
			const x = Math.abs(-sin(time)+10)/11;
			const y = Math.abs(sin(time)+10)/11;
	
			if(body) {
				body.scale.x = x;
				body.scale.y = y;
			}
	
			eyeGroup.scale.x = x;
			eyeGroup.scale.y = Math.abs(sin(time)+10)/10;;
	
			legsGroup.scale.x = x;
			legsGroup.scale.y = y;
	
			for(let i=0; i<legsArray.length; i++) {
				const mesh = legsArray[i];
				mesh.position.y = sin(time)/12;
				mesh.rotation.z = sin(time/2)/mesh.rand;
				mesh.rotation.x = sin(time/2)/mesh.rand;
			}
	
			squid.position.x = sin(time/2)/10;
			squid.position.y = sin(time)/8;

			const rot = time/2;

			// this.group.position.x = 2 * cos(rot);
			// this.group.position.z = 2 * sin(rot);

			// this.group.rotation.x = time;
			// this.group.rotation.y = -rot;

			this.group.position.x += this.positionX;
			this.group.position.z = this.positionZ;
		}
	
		function loadOBJ(squid) { 
			var loader = new THREE.OBJLoader();
	
			loader.load(
				'./models/polipo.obj',
				function ( object ) {
					object.traverse( function ( child ) {			
						if ( child instanceof THREE.Mesh ) {			
							child.material = new THREE.MeshToonMaterial({ color: "#B71C1C", reflectivity: 0, shininess: 10 });			
						}			
					});
	
					squid.add( object );
					body = object;
				},
				// called when loading is in progresses
				function ( xhr ) {},
				// called when loading has errors
				function ( error ) {
					console.log( 'An error happened' );
				}
			);
		}
	
		function buildEyes(squid) { 
			var geometry = new THREE.CircleGeometry( .06, 16 );
			var material = new THREE.MeshBasicMaterial( { color: "#000" } );
			var circle = new THREE.Mesh( geometry, material );
			circle.scale.x = .8;
			circle.scale.y = 1.1;
			circle.position.x = -.1
			circle.position.y = .5
			circle.position.z = .45
	
			const circle2 = circle.clone();
			circle2.position.x = .1;
	
			const eyeGroup = new THREE.Group();
			eyeGroup.add( circle );
			eyeGroup.add( circle2 );
	
			eyeGroup.position.y = -.28
	
			squid.add(eyeGroup);
			
			return eyeGroup;
		}
	
		function buildLegs(squid) {
			// CylinderGeometry(radiusTop, radiusBottom, height, radiusSegments, heightSegments, openEnded, thetaStart, thetaLength)
			const geometry = new THREE.CylinderBufferGeometry(.02, .008, .3, 8)
			const material = new THREE.MeshToonMaterial({ color: "#fff", reflectivity: 0, shininess: 10 });			
			var mesh = new THREE.Mesh( geometry, material );
	
			mesh.position.y = -.1
	
			const legsGroup = new THREE.Group();
	
			for(let i=0; i<16; i++) {
				const tMesh = mesh.clone();
				tMesh.scale.y = getRandom(.6, 1.4);
	
				tMesh.position.x = getRandom(-0.2, 0.2);
				tMesh.position.z = getRandom(-0.26, 0.26);
	
				legsGroup.add(tMesh);
				legsArray.push(tMesh);
				tMesh.rand = getRandomInt(2,6)
			}
	
			legsGroup.add(mesh);
			legsArray.push(mesh);
			mesh.rand = getRandomInt(2,6)
	
			squid.add(legsGroup);
	
			return legsGroup;
		}
	}
}