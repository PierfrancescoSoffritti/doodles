function SceneSubject(scene) {
	const self = this;
	
	this.group = new THREE.Group();
	this.group.position.set(0,0,-3);
	scene.add(this.group);

	this.obj;
	const aLegs = new Array();
	loadOBJ(this.group);

	const eyeGroup = buildEyes(this.group)
	const legs = buildLegs(this.group)

	this.update = function(time) {
		const x = Math.abs(-sin(time)+10)/11;
		const y = Math.abs(sin(time)+10)/11;

		if(self.obj) {
			self.obj.scale.x = x;
			self.obj.scale.y = y;
		}

		eyeGroup.scale.x = x;
		eyeGroup.scale.y = Math.abs(sin(time)+10)/10;;

		legs.scale.x = x;
		legs.scale.y = y;

		for(let i=0; i<aLegs.length; i++) {
			const mesh = aLegs[i];
			mesh.position.y = sin(time)/12;
			mesh.rotation.z = sin(time/2)/mesh.rand;
			mesh.rotation.x = sin(time/2)/mesh.rand;
		}

		this.group.position.x = sin(time/2)/10;
		this.group.position.y = sin(time)/8;
	}

	function loadOBJ(group) { 
		// instantiate a loader
		var loader = new THREE.OBJLoader();

		// load a resource
		loader.load(
			// resource URL
			'./models/polipo.obj',
			// called when resource is loaded
			function ( object ) {
				object.traverse( function ( child ) {			
					if ( child instanceof THREE.Mesh ) {			
						child.material = new THREE.MeshToonMaterial({ color: "#B71C1C", reflectivity: 0, shininess: 10 });			
					}			
				});

				group.add( object );
				self.obj = object;
			},
			// called when loading is in progresses
			function ( xhr ) {},
			// called when loading has errors
			function ( error ) {
				console.log( 'An error happened' );
			}
		);
	}

	function buildEyes(group) { 
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

		group.add(eyeGroup);
		
		return eyeGroup;
	}

	function buildLegs(group) {
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
			aLegs.push(tMesh);
			tMesh.rand = getRandomInt(2,6)
		}

		legsGroup.add(mesh);
		aLegs.push(mesh);
		mesh.rand = getRandomInt(2,6)

		group.add(legsGroup);

		return legsGroup;
	}
}