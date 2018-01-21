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
    const player = new Player(scene)
    const controls = buildControls(camera, player);

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
        camera.position.y = 2
        camera.position.z = 200

        return camera;
    }

    function buildControls(camera, player) {
        const controls = {
            polar: new PolarControls(camera, player, camera.position.z, 0),
            mouse: new MouseControls(camera, player)
        }
        
        return controls
    }

    function createSceneSubjects(scene) {
        const sceneSubjects = [
            new GeneralLights(scene),
            new SceneSubject(scene),
            // new Terrain(scene)
        ];

        return sceneSubjects;
    }

    this.update = function() {
        const elapsedTime = clock.getElapsedTime()
        for(let i=0; i<sceneSubjects.length; i++)
            sceneSubjects[i].update(elapsedTime);
            
        controls.polar.update(elapsedTime)
        controls.mouse.update(elapsedTime)

        player.update(elapsedTime)

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