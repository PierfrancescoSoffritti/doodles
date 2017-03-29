function Sphere(scene) {

    var uniforms = {
        time: {
            type: 'f',
            value: 0
        },
        mousePosition: { 
            type: "v3",
            value: new THREE.Vector2( 0, 0, 0 ) 
        }, 
    };

    var material = new THREE.ShaderMaterial( {
        uniforms,
        vertexShader: document.getElementById('vertexshader').textContent,
        fragmentShader: document.getElementById('fragmentshader').textContent,
        side: THREE.DoubleSide,
        wireframe: false
    });

    var geometry = new THREE.IcosahedronBufferGeometry(2, 5)
    geometry.computeVertexNormals();

    var mesh = new THREE.Mesh(geometry , material);
    scene.add(mesh);
    
    this.update = function(time, mousePosition) {
        material.uniforms.time.value = time;
        material.uniforms.mousePosition.value.x = mousePosition.x-0.5;
        material.uniforms.mousePosition.value.y = mousePosition.y-0.5;
        material.uniforms.mousePosition.value.z = .2;

        material.uniforms.mousePosition.value.y *= -1;
    }
}