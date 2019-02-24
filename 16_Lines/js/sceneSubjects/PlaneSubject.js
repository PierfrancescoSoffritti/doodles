function PlaneSubject(scene, indx, noiseMap, fallOff) {

    const widthSegments = noiseMap.length-1;
    var geometry = new THREE.PlaneGeometry( widthSegments/2, 0.1, widthSegments );

    const heights = getHeights(widthSegments+1, 20);

    const vertices = geometry.vertices;
    for(let i=0; i<widthSegments+1; i++) {
        vertices[i].y = heights[i];
    }

    var plane = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( {color: "#000"} ) );

    var material = new THREE.MeshBasicMaterial( {color: "#fff", side: THREE.DoubleSide, wireframe: true} );
    var plane2 = new THREE.Mesh( geometry, material );
    plane.add(plane2);

    plane.position.z = - indx * 0.5;
    scene.add( plane );

    function getHeights(numOfVertices, heightMuliplier) {
        const heights = [];

        const y = getRandomInt(0, noiseMap.length-1);
        for(let i=0; i<numOfVertices; i++)
            heights[i] = getHeight(i, y);

        for(let i=0; i<numOfVertices; i++)
            heights[i] *= fallOff[i];

        // normalize
        let sum = 0;
        for(let i=0; i<numOfVertices; i++)
            sum += heights[i];
        for(let i=0; i<numOfVertices; i++)
            heights[i] = heights[i]/sum;

        for(let i=0; i<numOfVertices; i++)
            heights[i] *= heightMuliplier;

        return heights;
    }

    function getHeight(x, y) {
        return noiseMap[x][y];
    }
    
        
    this.update = function(time) {
    }
}