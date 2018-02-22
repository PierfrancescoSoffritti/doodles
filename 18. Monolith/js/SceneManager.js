function SceneManager(canvas) {

    const clock = new THREE.Clock();
    
    const screenDimensions = {
        width: canvas.width,
        height: canvas.height
    }

    const gameStateManager = new GameStateManager()
    
    const scene = buildScene();
    const renderer = buildRender(screenDimensions);
    const camera = buildCamera(screenDimensions);    
    const { composer, timeDependentShaders } = buildPostProcessing(renderer, scene, camera);
    const sceneSubjects = createSceneSubjects(scene, gameStateManager.gameConstants);
    
    // these should be SceneSubjects
    const gameEntitiesManager = new GameEntitiesManager(scene, gameStateManager.gameConstants, gameStateManager.gameState)    
    const playerAndCameraPositionManager = new PlayerAndCameraPositionManager(camera, gameEntitiesManager.player, gameStateManager.gameConstants, gameStateManager.gameState)
    
    const controls = buildControls(playerAndCameraPositionManager, gameEntitiesManager.player, gameStateManager.gameConstants, gameStateManager.gameState)

    function buildScene() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#222");

        return scene;
    }

    function buildRender({ width, height }) {
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true }); 
        const DPR = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
        renderer.setPixelRatio(DPR);
        renderer.setSize(width, height);

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

    function buildPostProcessing(renderer, scene, camera) {
        const composer = new THREE.EffectComposer(renderer)
        const timeDependentShaders = []

        const renderPass = new THREE.RenderPass(scene, camera)
        renderPass.clear = true
        renderPass.clearDepth = true

        const filmPass = new THREE.ShaderPass(THREE.FilmShader)
        filmPass.uniforms["nIntensity"].value = 0.2
        filmPass.uniforms["sIntensity"].value = 0.2
        filmPass.uniforms["sCount"].value = 1600   
        filmPass.uniforms["grayscale"].value = 0

        rgbPass = new THREE.ShaderPass(THREE.RGBShiftShader)
        rgbPass.uniforms["angle"].value = 0 * Math.PI
        rgbPass.uniforms["amount"].value = 0.001

        const vignettePass = new THREE.ShaderPass(THREE.VignetteShader)
        vignettePass.uniforms["offset"].value = 1.4

        const glitchPass = new THREE.GlitchPass()

        composer.addPass(renderPass)
        composer.addPass(rgbPass)
        composer.addPass(vignettePass)
        composer.addPass(glitchPass)
        composer.addPass(filmPass)
        filmPass.renderToScreen = true

        timeDependentShaders.push(filmPass)

        eventBus.subscribe(decreaseLife, playGlitchEffect)

        return { composer, timeDependentShaders }

        function playGlitchEffect() {
            glitchPass.goWild = true

            const glitchTweenStart = new TWEEN.Tween(rgbPass.uniforms["amount"])
                .to({ value: 0.1 }, 150)
                .easing(TWEEN.Easing.Sinusoidal.InOut)
                .onComplete( () => {
                    const glitchTweenEnd = new TWEEN.Tween(rgbPass.uniforms["amount"])
                        .to({ value: 0.001 }, 150)
                        .easing(TWEEN.Easing.Sinusoidal.InOut)
                        .onComplete( () => glitchPass.goWild = false )
                        .start()
                })
                .start()
        }
    }

    function buildControls(playerAndCameraPositionManager, player, gameConstants, gameState) {
        const controls = {
            polar: new PolarControls(playerAndCameraPositionManager, gameConstants, gameState),
            mouse: new MouseControls(gameState, playerAndCameraPositionManager, player)
        }
        
        return controls
    }

    function createSceneSubjects(scene, gameConstants) {
        const sceneSubjects = [
            new Lights(scene),
            new Floor(scene, gameConstants),
            new Particles(scene, gameConstants),
        ]

        return sceneSubjects
    }

    this.update = function() {
        const elapsedTime = clock.getElapsedTime()
        const deltaTime = clock.getDelta()

        for(let i=0; i<sceneSubjects.length; i++)
            sceneSubjects[i].update(elapsedTime)

        for(let i=0; i<timeDependentShaders.length; i++)
            timeDependentShaders[i].uniforms['time'].value = deltaTime

        gameStateManager.update(elapsedTime)
            
        controls.polar.update(elapsedTime)
        controls.mouse.update(elapsedTime)

        playerAndCameraPositionManager.update(elapsedTime)
        gameEntitiesManager.update(elapsedTime)

        composer.render(deltaTime)
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

    this.introScreenClosed = function() {
        eventBus.post(introScreenClosed)
    }

    this.onKeyDown = function(keyCode) {
        if(!gameStateManager.gameState.enableUserInput)
            return

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
        if(!gameStateManager.gameState.enableUserInput)
            return

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
        if(!gameStateManager.gameState.enableUserInput)
            return
        controls.mouse.onMouseDown(event)
    }

    this.onMouseUp = function(event) {
        if(!gameStateManager.gameState.enableUserInput)
            return
        controls.mouse.onMouseUp(event)
    }
}