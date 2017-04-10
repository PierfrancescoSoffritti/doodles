function SceneManager(canvas) {
	canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;

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

    var cameraControls;
    var camera = buildCamera(width, height);

    var renderer = buildRender(width, height);
    
    var sceneSubjects = new Array();
    const terrainSubject = new Terrain(scene);
    sceneSubjects.push(terrainSubject);
    // sceneSubjects.push(new EndlessTerrain(scene, camera, 240));
    
    const collisionManager = new TerrainCollisionManager(camera, terrainSubject.terrain);

    function buildLights(scene) {
        var light = new THREE.HemisphereLight( "#fff", "#000", 1 );
        scene.add(light);

        var light = new THREE.SpotLight("#fff", 2);
        light.castShadow = true;
        light.position.y = 7;
        light.position.z = 150;

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
        var farPlane = 4000; 
        var camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane);

        camera.position.y = 10;
        // camera.position.z = 200;
        // camera.lookAt(new THREE.Vector3(0,0,0));

        cameraControls = new CameraFirstPersonControls(camera);
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

        for(var i=0; i<sceneSubjects.length; i++)
        	sceneSubjects[i].update(clock.getElapsedTime(), camera);

        cameraControls.update(clock.getDelta());
        collisionManager.update();

        renderer.render(scene, camera);
    };

    this.onWindowResize = function() {
        var canvas = document.getElementById("canvas");
        var width = document.body.clientWidth;
        var height = document.body.clientHeight;
        canvas.width = width;
        canvas.height = height;

        camera.aspect = width /height;
        camera.updateProjectionMatrix();
        
        renderer.setSize(width, height);
    }

    this.onMouseMove = function(mouseX, mouseY) {
    }
}