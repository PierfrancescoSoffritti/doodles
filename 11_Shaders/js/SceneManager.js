function SceneManager(canvas) {
	canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;

    var time = 0;

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
    
    var sceneSubjects = new Array();
    sceneSubjects.push(new Background(scene));
    sceneSubjects.push(new Sphere(scene));

    function buildLights(scene) {
        var light = new THREE.HemisphereLight( "#fff", "#000", 1 );
        scene.add(light);

        var light = new THREE.SpotLight("#fff", 2);
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
        var nearPlane = 0.5;
        var farPlane = 500; 
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

    this.update = function() {
        time++;

        // camera position, relative to mouse position
        // camera.position.x += (  (mousePosition.x * 0.001) - camera.position.x ) * 0.04;
        // camera.position.y += ( -(mousePosition.y * 0.002) - camera.position.y ) * 0.04;
        // camera.lookAt(new THREE.Vector3(0,0,0));

        // move the light
        // light.position.x = Math.sin(time*0.01)*50;

        for(var i=0; i<sceneSubjects.length; i++)
        	sceneSubjects[i].update(time, mousePosition);

        renderer.render(scene, camera);
    };

    this.onWindowResize = function() {
        var canvas = document.getElementById("canvas");
        width = document.body.clientWidth;
        height = document.body.clientHeight;
        canvas.width = width;
        canvas.height = height;

        camera = buildCamera(width, height);
        
        renderer.setSize(width, height);
    }

    var timeout = null;
    this.onMouseMove = function(mouseX, mouseY) {
        clearTimeout(timeout);

        mousePosition.x = mouseX/width;
        mousePosition.y = mouseY/height;
        mousePosition.disabled = false;

    	timeout = setTimeout(function() {
	        mousePosition.disabled = true;
	    }, 2000);
    }
}