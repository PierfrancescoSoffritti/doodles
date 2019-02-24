function Head(scene) {

    var self = this;

    var deform = false;
    var head, wireframe;
    var material = new THREE.MeshStandardMaterial({ color: "#000", roughness: .5, metalness: .5, flatShading: false });

    var vertices = new Array();

    var loader = new THREE.JSONLoader();
    loader.load('head.json', function(geometry) {
        head = new THREE.Mesh(geometry);
        head.material = material
        scene.add(head);

        wireframe = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial()
        );

        scene.add(wireframe)

        for(var i=0; i<head.geometry.vertices.length/15; i++) {
            var vertex = head.geometry.vertices[Math.floor(getRandom(0, head.geometry.vertices.length-1))];
            vertex.baseX = vertex.x;
            vertex.baseY = vertex.y;
            vertex.baseZ = vertex.z;
            vertex.randomFact = Math.random();
            vertices.push(vertex);
        }

        self.showMesh(false);
        self.showWireframe(false);
    });

    var speed = 0.01;
    this.update = function(time, mousePosition) {
        if(!head)
            return;

        head.material.color.setHSL( Math.sin(time * speed), 0.5, 0.5 );

        if(deform) {
            vertices.forEach((vertex) => {
                // vertex.x = vertex.baseX + Math.sin(time*speed) * vertex.randomFact;
                vertex.y = vertex.baseY - Math.abs(Math.sin(time*speed)) * vertex.randomFact;
                // vertex.z = vertex.baseZ + Math.sin(time*speed) * vertex.randomFact;
            });
            head.geometry.verticesNeedUpdate = true;
        }

        wireframe.material.color.setHSL( Math.sin(time * speed), 0.5, 0.5 );

    }

    this.moveTo = function (x, y, z) {
        if(head) {
            head.position.set(x, y, z);
            wireframe.position.set(x, y, z);
        }
    }

    this.showMesh = function(show) {
        if(head)
            head.visible = show;
    }

    this.showWireframe = function(show) {
        if(head)
            wireframe.visible = show;
    }

    this.deform = function(def) {
        deform = def;
    }
}