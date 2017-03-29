function onLoad() {

    const canvas = document.getElementById("canvas");

    window.onresize = resizeCanvas;

    var values = new Array();
    for(var i=0; i<100; i++) {
        values.push( Math.floor(getRandom(1, 1000)) );
    }

    var tree = new CollatzTreeBuilder().build(values);
    const sceneManager = new SceneManager(canvas, tree);

    resizeCanvas();

    render();

    function render() {
        requestAnimationFrame(render);
    }

    function resizeCanvas() {
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";

        sceneManager.onWindowResize();
        sceneManager.update();
    }
}