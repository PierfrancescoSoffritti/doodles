function SceneManager(canvas) {
	canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;

    var time = 0;
    var clock = new THREE.Clock();

    var mousePosition = {
        x: 0,
        y: 0,
        disabled: true
    };

    var width = canvas.width;
    var height = canvas.height;
  
    var scene = new THREE.Scene();

    scene.background = new THREE.Color("#202020");

    var light = buildLights(scene);
    var camera = buildCamera(width, height);
    var renderer = buildRender(width, height);
    var glitchPass;
    var composer = buildPostProcessing(renderer, scene, camera);
    
    var sceneSubjects = new Array();
    var background = new Background(scene)
    var pyramid = new Pyramid(scene)
    var cubes = new Cubes(scene)
    var eyes = new Eyes(scene)
    var head = new Head(scene);
    var heads = new Heads(scene);

    sceneSubjects.push(background);
    sceneSubjects.push(pyramid);
    sceneSubjects.push(cubes);
    sceneSubjects.push(eyes);
    sceneSubjects.push(head);
    sceneSubjects.push(heads);

    var mainRow = cubes;

    function buildPostProcessing(renderer, scene, camera) {
        glitchPass = new THREE.GlitchPass();
        glitchPass.renderToScreen = true;

        var effectFilm = new THREE.FilmPass(1, 0.2, 256/2, false);
        effectFilm.renderToScreen = false;

        var composer = new THREE.EffectComposer(renderer);

        composer.addPass(new THREE.RenderPass(scene, camera));
        composer.addPass(effectFilm)
        composer.addPass(glitchPass);

        return composer;
    }

    function buildLights(scene) {
        var light = new THREE.HemisphereLight( "#fff", "#000", 1 );
        scene.add(light);

        var light = new THREE.SpotLight("#fff", .4);
        light.castShadow = true;
        light.position.y = 7;
        light.position.z = 18;

        light.decacy = 2;
        light.penumbra = 1;

        light.shadow.camera.near = 10;
        light.shadow.camera.far = 1000;
        light.shadow.camera.fov = 30;

        scene.add(light);

        //var spotLightHelper = new THREE.SpotLightHelper( light );
		//scene.add( spotLightHelper )

        return light;
    }

    function buildCamera(width, height) {
        var aspectRatio = width / height;
        var fieldOfView = 60;
        var nearPlane = 0.1;
        var farPlane = 600; 
        var camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane);

        camera.position.z = 6;

        camera.lookAt(new THREE.Vector3(0,0,0));

        return camera;
    }

    function buildRender(width, height) {
        var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); 
        var DPR = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
        renderer.setPixelRatio(DPR);
        renderer.setSize(width, height);

        renderer.gammaInput = true;
        renderer.gammaOutput = true; 

        return renderer;
    }

    this.update = function(musicManager) {
        time++;

        for(var i=0; i<sceneSubjects.length; i++)
        	sceneSubjects[i].update(time, mousePosition);

        if(musicManager.getAverageAmplitude() > 0.21) {
            glitchPass.curF = glitchPass.randX / 21;
            
            if(mainRow)
                mainRow.show(false);

            eyes.show(true);
        }
        else {
            
            if(mainRow)
                mainRow.show(true);

            eyes.show(false);
        }
        
        var delta = clock.getDelta();
        composer.render(delta);
    };

    this.onSongTimeUpdate = function(time) {
        // console.log(time);


        if(time > 11 && time < 12) {
            glitchPass.off = true;
        } else if(time > 12 && time < 13) {
            // pyramid.moveTo(0, 0, 3);
            light.intensity = 10;
            glitchPass.off = false;
        }
        else if(time > 22 && time < 23) {
            // pyramid.moveTo(0, 0, 0);
            light.intensity = .4;
            pyramid.show(false);
        }
        else if(time > 32.1 && time < 33) {
            pyramid.moveTo(0, 0, -30);
            pyramid.show(true);
        } else if(time > 42.1 && time < 43) {
            head.showMesh(true);
        } else if(time > 52.1 && time < 53) {
            head.deform(true);
        } else if(time > 62.1 && time < 63) {
            head.moveTo(0, 0, 2.5);
        } else if(time > 72.1 && time < 73) {
            pyramid.moveTo(0, 0, 0);
            head.showMesh(false);

            mainRow = heads;
            heads.show(true);            
            cubes.show(false);
        } else if(time > 82.1 && time < 83) {           
            heads.lookAt(true);
        } else if(time > 102.4 && time < 103.4) {
            light.color.setRGB(158, 0, 0);
            head.showMesh(false)
            head.showWireframe(true)
            head.moveTo(0, 0, 1.5);
        } else if(time > 112.6 && time < 113.6) {
            head.moveTo(0, 0, 2.5);

            mainRow = cubes;
            heads.show(false);
            cubes.show(true);

            light.color.setRGB(0, 0, 0);
            light.intensity = 0;
        } else if(time > 122.6 && time < 123.6) {
            // kill the light :D
            light.color = "#000";
        }  else if(time > 152 && time < 153) {
            mainRow = null;

            heads.show(false);
            cubes.show(false);
            pyramid.show(false);
        }
    }

    this.onWindowResize = function() {
        var canvas = document.getElementById("canvas");
        var width = document.body.clientWidth;
        var height = document.body.clientHeight;
        canvas.width = width;
        canvas.height = height;

        camera.aspect = width /height;
        camera.updateProjectionMatrix();
        
        renderer.setSize(width, height);
        composer.setSize(width, height);
    }

    var timeout = null;
    this.onMouseMove = function(mouseX, mouseY) {
        clearTimeout(timeout);

        mousePosition.x = mouseX;
        mousePosition.y = mouseY;
        mousePosition.disabled = false;

    	timeout = setTimeout(function() {
	        mousePosition.disabled = true;
	    }, 2000);
    }
}