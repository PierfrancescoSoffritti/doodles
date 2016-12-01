function SceneManager(canvas) {
	canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;

    var time = 0;

    var width = canvas.width;
    var height = canvas.height;
  
    var scene = new THREE.Scene();
    scene.background = new THREE.Color("#202020");

    var light = buildLights(scene);
    var camera = buildCamera(width, height);
    var renderer = buildRender(width, height);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);

    var sceneSubjects = new Array();
    sceneSubjects.push(new BallSceneSubject(scene));
    sceneSubjects.push(new GrassSceneSubject(scene));

    function buildLights(scene) {      
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

        camera.position.z = 3;
        camera.position.y = 5;

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

        // move the light
        light.position.x = Math.sin(time*0.01)*200;

        for(var i=0; i<sceneSubjects.length; i++)
        	sceneSubjects[i].update(time);

        controls.update();
        renderer.clear();
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

        var controls = new THREE.OrbitControls(camera, renderer.domElement);
    }
}