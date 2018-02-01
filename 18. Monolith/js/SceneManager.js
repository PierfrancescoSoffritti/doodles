function SceneManager(canvas) {

    const clock = new THREE.Clock();
    
    const screenDimensions = {
        width: canvas.width,
        height: canvas.height
    }

    const gameConstants = {
        minRadius: 50,
        maxRadius: 200,
        baseLevelHeight: 10,
        secondLevelHeight: 20
    }
    
    const scene = buildScene();
    const renderer = buildRender(screenDimensions);
    const camera = buildCamera(screenDimensions);    
    const composer = buildPostProcessing(renderer, scene, camera);


    const soundManager = new SoundManager(camera)
    
    const sceneSubjects = createSceneSubjects(scene);
    
    // these should be SceneSubjects
    const gameEntitiesManager = new GameEntitiesManager(scene, gameConstants)    
    const playerAndCameraPositionManager = new PlayerAndCameraPositionManager(camera, gameEntitiesManager.player, gameConstants)
    const controls = buildControls(playerAndCameraPositionManager, gameEntitiesManager.player, gameConstants);

    function buildScene() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#000");

        return scene;
    }

    function buildRender({ width, height }) {
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); 
        const DPR = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
        renderer.setPixelRatio(DPR);
        renderer.setSize(width, height);

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

        renderer.gammaInput = true;
        renderer.gammaOutput = true; 

        return renderer;
    }

    function buildCamera({ width, height }) {
        const aspectRatio = width / height;
        const fieldOfView = 60;
        const nearPlane = .1;
        const farPlane = 500; 
        const camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane);

        return camera;
    }

    var filmPass
    var staticPass

    function buildPostProcessing(renderer, scene, camera) {
        const composer = new THREE.EffectComposer(renderer);

        const renderPass = new THREE.RenderPass(scene, camera);
        renderPass.clear = true;
        renderPass.clearDepth = true;
        // renderPass.renderToScreen = true;

        filmPass = new THREE.ShaderPass(THREE.FilmShader);
        filmPass.uniforms["nIntensity"].value = 0.2;
        filmPass.uniforms["sIntensity"].value = 0.45;
        filmPass.uniforms["sCount"].value = 1600;        
        filmPass.uniforms["grayscale"].value = 0;

        staticPass = new THREE.ShaderPass(THREE.StaticShader);
        staticPass.uniforms["amount"].value = 0.08;
        staticPass.uniforms["size"].value = 2;

        const rgbPass = new THREE.ShaderPass(THREE.RGBShiftShader);
        rgbPass.uniforms["angle"].value = 0 * Math.PI;
        rgbPass.uniforms["amount"].value = 0.001;

        composer.addPass(renderPass);
        composer.addPass(staticPass);
        composer.addPass(rgbPass);
        composer.addPass(filmPass);
        filmPass.renderToScreen = true;

        return composer;
    }

    function buildControls(playerAndCameraPositionManager, player, gameConstants) {
        const controls = {
            polar: new PolarControls(playerAndCameraPositionManager, gameConstants),
            mouse: new MouseControls(playerAndCameraPositionManager, player)
        }
        
        return controls
    }

    function createSceneSubjects(scene) {
        const sceneSubjects = [
            new Lights(scene),
            new Floor(scene)
        ];

        return sceneSubjects;
    }

    this.update = function() {
        const elapsedTime = clock.getElapsedTime()
        for(let i=0; i<sceneSubjects.length; i++)
            sceneSubjects[i].update(elapsedTime);
            
        controls.polar.update(elapsedTime)
        controls.mouse.update(elapsedTime)

        playerAndCameraPositionManager.update(elapsedTime)
        gameEntitiesManager.update(elapsedTime)

        const delta = clock.getDelta()
        filmPass.uniforms['time'].value = delta;
        staticPass.uniforms['time'].value = delta;

        // renderer.render(scene, camera);
        composer.render(delta);
    }

    this.onWindowResize = function() {
        const { width, height } = canvas;

        screenDimensions.width = width;
        screenDimensions.height = height;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        renderer.setSize(width, height);
        composer.setSize(width, height);
    }

    this.onKeyDown = function(keyCode) {
        // refactor. this is a hack
        if(keyCode === 32) {
            //sapce
            this.onMouseDown({ which: 3})
            return
        } else if(keyCode === 77) {
            // m
            this.onMouseDown({ which: 1})
            return
        }

        controls.polar.onKeyDown(keyCode)
    }

    this.onKeyUp = function(keyCode) {
        // refactor. this is a hack
        if(keyCode === 32) {
            //sapce
            this.onMouseUp({ which: 3})
            return
        } else if(keyCode === 77) {
            // m
            this.onMouseUp({ which: 1})
            return
        }

        controls.polar.onKeyUp(keyCode)        
    }

    this.onMouseDown = function(event) {
        controls.mouse.onMouseDown(event)
    }

    this.onMouseUp = function(event) {
        controls.mouse.onMouseUp(event)
    }
}