function Sphere(scene) {

    var uniforms = {
        time: {
            type: 'f',
            value: 0
        },
        normalsDirection: {
            type: 'f',
            value: 1.0
        }
    };

    var material = new THREE.ShaderMaterial( {
        uniforms,
        vertexShader: document.getElementById('vertexshader').textContent,
        fragmentShader: document.getElementById('fragmentshader').textContent,
        side: THREE.DoubleSide,
        wireframe: false
    });

    var geometry = new THREE.IcosahedronBufferGeometry(2, 5)
    // geometry.computeVertexNormals();

    var mesh = new THREE.Mesh(geometry , material);
    scene.add(mesh);
    
    this.update = function(time, mousePosition) {
        material.uniforms.time.value = time;
    }
}