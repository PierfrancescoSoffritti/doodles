var canvas = document.getElementById("canvas");

window.onresize = resizeCanvas;

// (function(){var script=document.createElement('script');script.onload=function(){var stats=new Stats();document.body.appendChild(stats.dom);requestAnimationFrame(function loop(){stats.update();requestAnimationFrame(loop)});};script.src='//rawgit.com/mrdoob/stats.js/master/build/stats.min.js';document.head.appendChild(script);})()

resizeCanvas();

const eventBus = new EventBus();

const notesGenerator = new NotesGenerator();
const backgroundTuneGenerator = new BackgroundTuneGenerator(notesGenerator);
const viewFinderManager = new ViewFinderManager();
var sceneManager = new SceneManager(canvas);

render();

function render(time) {
    requestAnimationFrame(render);
    TWEEN.update(time);
    sceneManager.update();
}

function resizeCanvas() {
    var canvas = document.getElementById("canvas");
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    if(sceneManager)
        sceneManager.onWindowResize();
}