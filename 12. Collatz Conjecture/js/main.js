function onLoad() {

    const canvas = document.getElementById("canvas");

    window.onresize = resizeCanvas;

    var values = new Array();
    for(var i=0; i<100; i++) {
        values.push( Math.floor(getRandom(1, 1000)) );
    }

    var tree = new CollatzTreeBuilder().build(values);
    // DFS(tree, node => console.log(node.value));
    const sceneManager = new SceneManager(canvas, tree);

    // set canvas size (size on screen, not resolution) programmatically
    resizeCanvas();

    render();

    window.onmousemove = onMouseMove;

    function render() {
        requestAnimationFrame(render);

    }

    function onMouseMove(event) {
    	var mouseX = event.pageX;
        var mouseY = event.pageY;

    	sceneManager.onMouseMove(mouseX, mouseY);
    }

    function resizeCanvas() {
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";

        sceneManager.onWindowResize();
        sceneManager.update();
    }
}