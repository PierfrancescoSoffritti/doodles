function PlanesSubject(scene) {
    
    const size = 256;
    const mapGenerator = new MapGenerator(size, 150, 10, .9, 2, 1, [0, 0], false);
    const map = mapGenerator.generateMap();

    const fallOff = buildFallOff(size+1)

    for(let i=0; i<100; i++) {
        const p = new PlaneSubject(scene, i, map, fallOff);
    }

    function buildFallOff(numOfVertices) {
        const fallOff = [];  
        for(let i=-numOfVertices/2; i<numOfVertices/2; i++) { 
            const value = ( (Math.sin(i/10) / i) * 10 ) + (Math.sin(i/3) / i) ;            
            fallOff[i+numOfVertices/2] = value < 0 ? 0 : value;

            if(i === 0) {
                const val = (fallOff[i-1+numOfVertices/2] + fallOff[i-2+numOfVertices/2])/2;
                fallOff[i+numOfVertices/2] = val;
            }
        }

        return fallOff;
    }
            
    this.update = function(time) {
    }
}