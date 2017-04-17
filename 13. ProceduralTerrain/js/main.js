var canvas = document.getElementById("canvas");
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

window.onresize = resizeCanvas;

(function(){var script=document.createElement('script');script.onload=function(){var stats=new Stats();document.body.appendChild(stats.dom);requestAnimationFrame(function loop(){stats.update();requestAnimationFrame(loop)});};script.src='//rawgit.com/mrdoob/stats.js/master/build/stats.min.js';document.head.appendChild(script);})()

resizeCanvas();

const eventBus = new EventBus();

const fftSize = 16384;
const notesGenerator = new NotesGenerator(fftSize);
const backgroundTuneGenerator = new BackgroundTuneGenerator();
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