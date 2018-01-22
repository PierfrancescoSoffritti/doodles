function SceneManager(canvas) {

    const clock = new THREE.Clock();
    
    const screenDimensions = {
        width: canvas.width,
        height: canvas.height
    }
    
    const scene = buildScene();
    const renderer = buildRender(screenDimensions);
    const camera = buildCamera(screenDimensions);
    const sceneSubjects = createSceneSubjects(scene);
    
    // these should be SceneSubjects
    const gameEntitiesManager = new GameEntitiesManager(scene)    
    const playerAndCameraPositionManager = new PlayerAndCameraPositionManager(camera, gameEntitiesManager.player)
    const controls = buildControls(playerAndCameraPositionManager, gameEntitiesManager.player);

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
        const nearPlane = 1;
        const farPlane = 500; 
        const camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane);

        return camera;
    }

    function buildControls(playerAndCameraPositionManager, player) {
        const controls = {
            polar: new PolarControls(playerAndCameraPositionManager, 100, 200, 0),
            mouse: new MouseControls(playerAndCameraPositionManager, player)
        }
        
        return controls
    }

    function createSceneSubjects(scene) {
        const sceneSubjects = [
            new Lights(scene),
            new Floor(scene),
            new Monolith(scene),
        ];

        return sceneSubjects;
    }

    this.update = function() {
        const elapsedTime = clock.getElapsedTime()
        for(let i=0; i<sceneSubjects.length; i++)
            sceneSubjects[i].update(elapsedTime);
            
        controls.polar.update(elapsedTime)
        controls.mouse.update(elapsedTime)

        gameEntitiesManager.update(elapsedTime)

        renderer.render(scene, camera);
    }

    this.onWindowResize = function() {
        const { width, height } = canvas;

        screenDimensions.width = width;
        screenDimensions.height = height;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        renderer.setSize(width, height);
    }

    this.onKeyDown = function(keyCode) {
        controls.polar.onKeyDown(keyCode)
    }

    this.onKeyUp = function(keyCode) {
        controls.polar.onKeyUp(keyCode)        
    }

    this.onMouseDown = function(event) {
        controls.mouse.onMouseDown(event)
    }

    this.onMouseUp = function(event) {
        controls.mouse.onMouseUp(event)
    }
}