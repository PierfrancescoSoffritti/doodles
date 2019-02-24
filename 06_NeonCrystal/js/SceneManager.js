function SceneManager(canvas) {
	canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;

    var time = 0;

    var mousePosition = {
        x: 0,
        y: 0
    };

    var width = canvas.width;
    var height = canvas.height;
  
    var scene = new THREE.Scene();
    scene.background = new THREE.Color("#202020");

    var light = buildLights(scene);
    var camera = buildCamera(width, height);
    var renderer = buildRender(width, height);

    var cubeCamera = new THREE.CubeCamera(0.5, 500, 1024);
    scene.add(cubeCamera);
    
    var sceneSubjects = new Array();
    sceneSubjects.push(new CrystalSceneSubject(scene, cubeCamera));

    function buildLights(scene) {  
        var light = new THREE.DirectionalLight("#fff", 0.4);    
        light.position.x = -50;
        light.target.position.set(0,0,0)
        scene.add(light);

        var light = new THREE.DirectionalLight("#fff", 0.2);    
        light.position.x = 50;
        light.position.z = 50;
        light.target.position.set(0,0,0)
        scene.add(light);

        var light = new THREE.SpotLight("#fff", 0.8);
        light.position.y = 100;

        light.angle = 1.05;

        light.decacy = 2;
        light.penumbra = 1;

        light.shadow.camera.near = 10;
        light.shadow.camera.far = 1000;
        light.shadow.camera.fov = 30;

        scene.add(light);

        return light;
    }

    function buildCamera(width, height) {
        var aspectRatio = width / height;
        var fieldOfView = 60;
        var nearPlane = 0.5;
        var farPlane = 500; 
        var camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane);

        camera.position.z = 6;
        camera.position.y = 8;

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
        camera.position.x += (  (mousePosition.x * 0.001) - camera.position.x ) * 0.04;
        camera.position.y += ( -(mousePosition.y * 0.002) - camera.position.y ) * 0.04;
        camera.lookAt(new THREE.Vector3(0,0,0));

        // move the light
        light.position.x = Math.sin(time*0.01)*50;

        for(var i=0; i<sceneSubjects.length; i++)
        	sceneSubjects[i].update(time);

        cubeCamera.update(renderer, scene);

        renderer.render(scene, camera);
    };

    this.onWindowResize = function() {
        var canvas = document.getElementById("canvas");
        var width = document.body.clientWidth;
        var height = document.body.clientHeight;
        canvas.width = width;
        canvas.height = height;

        camera = buildCamera(width, height);
        
        renderer.setSize(width, height);
    }

    this.onMouseMove = function(mouseX, mouseY) {
        mousePosition.x = mouseX;
        mousePosition.y = mouseY;
    }
}