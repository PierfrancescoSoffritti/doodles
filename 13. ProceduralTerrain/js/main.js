var canvas = document.getElementById("canvas");
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

window.onresize = resizeCanvas;

resizeCanvas();

var sceneManager = new SceneManager(canvas);

render();

window.onmousemove = onMouseMove;

function render() {
    requestAnimationFrame(render);
    sceneManager.update();
}

function onMouseMove(event) {
	var mouseX = event.pageX-windowHalfX;
    var mouseY = event.pageY-windowHalfY;

	sceneManager.onMouseMove(mouseX, mouseY);
}

function resizeCanvas() {
    var canvas = document.getElementById("canvas");
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    if(sceneManager)
        sceneManager.onWindowResize();
}