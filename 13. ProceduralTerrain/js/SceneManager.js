function SceneManager(canvas) {
	canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;

    var width = canvas.width;
    var height = canvas.height;

    var clock = new THREE.Clock();
  
    // scene setup
    var scene = new THREE.Scene();
    scene.background = new THREE.Color("#000033");
    scene.fog = new THREE.Fog( "#990099", 1, 4000 )

    var renderer = buildRender(width, height);
    var camera = buildCamera(width, height);
    var light = buildLights(scene);

    var cubeCamera = new THREE.CubeCamera(1, 10000, 512);   
    scene.add(cubeCamera);

    const terrainSubject = new Terrain(scene, cubeCamera);

    const collisionManager = new TerrainCollisionManager(terrainSubject.terrain);

    const cameraControls = new PointerLockManager(camera, scene, collisionManager);
    const player = cameraControls.getObject();
    collisionManager.objects.push(player);
    
    var sceneSubjects = [];
    sceneSubjects.push(terrainSubject);
    sceneSubjects.push(new Skydome(scene, terrainSubject.size));
    sceneSubjects.push(new EntitiesSpawner(scene, player, collisionManager, terrainSubject.size, cubeCamera));
    sceneSubjects.push(new MonolithsSpawner(scene, player, collisionManager, terrainSubject.size, cubeCamera));

    let timeFactor = 1;
    eventBus.subscribe(toggleTime, () => { timeFactor = timeFactor === 1 ? 20 : 1 });

    function buildRender(width, height) {
        var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); 
        var DPR = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
        renderer.setPixelRatio(DPR);
        renderer.setSize(width, height);

        renderer.gammaInput = true;
        renderer.gammaOutput = true; 

        return renderer;
    }


    function buildCamera(width, height) {
        var aspectRatio = width / height;
        var fieldOfView = 60;
        var nearPlane = 5;
        var farPlane = 10000; 
        var camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane);

        return camera;
    }

    function buildLights(scene) {
        var light = new THREE.SpotLight("#2222ff", 1);
        light.position.y = 700;
        light.position.z = 0;
        light.position.x = -1400;

        light.decacy = 2;
        light.penumbra = 1;
        scene.add(light);

        return light;
    }

    this.update = function() {

        for(var i=0; i<sceneSubjects.length; i++)
        	sceneSubjects[i].update(clock.getElapsedTime()*timeFactor, player);

        cameraControls.update();
        collisionManager.update();

        cubeCamera.position.set(player.position.x, player.position.y, player.position.z)
        cubeCamera.updateCubeMap(renderer, scene);

        renderer.render(scene, camera);
    }

    this.onWindowResize = function() {
        width = document.body.clientWidth;
        height = document.body.clientHeight;
        canvas.width = width;
        canvas.height = height;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        renderer.setSize(width, height);
    }
}