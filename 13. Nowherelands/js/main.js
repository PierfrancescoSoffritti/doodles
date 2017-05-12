const canvas = document.getElementById("canvas");

window.onresize = resizeCanvas;

// (function(){var script=document.createElement('script');script.onload=function(){var stats=new Stats();document.body.appendChild(stats.dom);requestAnimationFrame(function loop(){stats.update();requestAnimationFrame(loop)});};script.src='//rawgit.com/mrdoob/stats.js/master/build/stats.min.js';document.head.appendChild(script);})()

resizeCanvas();

const eventBus = new EventBus();

const notesGenerator = new NotesGenerator();
const backgroundTuneGenerator = new BackgroundTuneGenerator(notesGenerator);
const viewFinderManager = new ViewFinderManager();
var sceneManager = new SceneManager(canvas);

const intro = document.getElementsByClassName('intro')[0];
const blocker = document.getElementById("blocker");

function fadeOverlay() {

	setTimeout(function() {
		intro.classList.add('fade');

		setTimeout(function() {
			blocker.classList.add('go-on-top');
		}, 2200);

		setTimeout(function() { 
			intro.parentNode.removeChild(intro);
		}, 4000);
		
	}, 1000);
}

fadeOverlay();

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