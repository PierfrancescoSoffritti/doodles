function Heads(scene) {
    var self = this;

	var group = new THREE.Group();

    var lookAt = false;

    var head;
    var material = new THREE.MeshStandardMaterial({ color: "#000", roughness: .5, metalness: .5, flatShading: true });

    var cols = new Array();

    var loader = new THREE.JSONLoader();
    loader.load('head.json', function(geometry) {
        head = new THREE.Mesh(geometry);
        head.material = material

        var scale = .7;
        head.scale.set(scale, scale, scale)

        for(var i=0; i<20; i+=2) {
            cols.push([]);
        }
        
        for(var x=-20; x<20; x+=2.5) {
            for(var y=-20; y<20; y+=2) {
                for(var z=0; z<20; z+=2) {

                    if(x === 0 && y === 0)
                        continue;

                    var tSubject = head.clone();

                    tSubject.position.set(x, y, -z);
                    group.add(tSubject);

                    cols[z/2].push(tSubject);
                }
            }
        }

        self.show(false);
    });

    scene.add(group);

    var speed = 0.01;

    var show = true;

    this.show = function(s) {
    	show = s

        for(var i=0; i<cols.length; i++) {
            cols[i].forEach((subject) => subject.visible = show );
        }
    }

    this.lookAt = function(look) {
        lookAt = look;
    }

    this.update = function(time, mousePosition) {
        if(!show)
            return;

        if(cols.length == 0)
            return;

        // geometry.vertices[0].y = Math.sin(time*speed) 
        // geometry.verticesNeedUpdate = true;
        
        material.color.setHSL( Math.sin(time * speed), 0.5, 0.5 );
        
        for(var i=0; i<cols.length; i++) {
        	cols[i].forEach((subject) => { 
                var pos = subject.position.z+speed; subject.position.z = pos < 6 ? pos : -20+6; subject.visible = show;
                
                if(lookAt) 
                    subject.lookAt(new THREE.Vector3(0, 0, 6));
            });
        }
        // group.position.z = time * speed;
    }
}