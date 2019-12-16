function SceneManager(canvas) {

    const clock = new THREE.Clock();
    
    const screenDimensions = {
        width: canvas.width,
        height: canvas.height
    }
    
    const scene = buildScene();
    const renderer = buildRender(screenDimensions);
    const camera = buildCamera(screenDimensions);
    const { composer, timeDependentShaders } = buildPostProcessing(renderer, scene, camera);
    const sceneSubjects = createSceneSubjects(scene);

    function buildScene() {
        const scene = new THREE.Scene();
        const color = '#be462d';

        // const near = 1;
        // const far = 2;
        // scene.fog = new THREE.Fog(color, near, far);

        const density = 0.15;
        scene.fog = new THREE.FogExp2(color, density);
        scene.background = new THREE.Color(color);

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
        const nearPlane = 0.1;
        const farPlane = 100; 
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
      filmPass.uniforms["nIntensity"].value = 0.1
      filmPass.uniforms["sIntensity"].value = 0.1
      filmPass.uniforms["sCount"].value = 1600
      filmPass.uniforms["grayscale"].value = 0

      const vignettePass = new THREE.ShaderPass(THREE.VignetteShader)
      vignettePass.uniforms["offset"].value = 1.4

      composer.addPass(renderPass)
      composer.addPass(vignettePass)
      composer.addPass(filmPass)
      filmPass.renderToScreen = true

      timeDependentShaders.push(filmPass)

      return { composer, timeDependentShaders }
  }

    function createSceneSubjects(scene) {
        const sceneSubjects = [
            new GeneralLights(scene),
            new SceneSubject(scene),
            new Floor(scene),
            new Fog(scene)
        ];

        return sceneSubjects;
    }

    this.update = function() {
        const elapsedTime = clock.getElapsedTime();
        const deltaTime = clock.getDelta()

        for(let i=0; i<timeDependentShaders.length; i++)
            timeDependentShaders[i].uniforms['time'].value = deltaTime

        // console.log(scene.fog.color)
        const speed = 1

        const hue = ((Math.sin(elapsedTime * speed )+1) / 2) *0.05
        
        // const lum = ((Math.sin(elapsedTime * speed )+1.5) / 3)
        const lum = 0.4

        // console.log("H: " +hue +" L: " +lum)

        scene.fog.color.setHSL( hue, 0.9, lum );
        scene.background.setHSL( hue, 0.9, lum );

        for(let i=0; i<sceneSubjects.length; i++)
        	sceneSubjects[i].update(elapsedTime);

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
}