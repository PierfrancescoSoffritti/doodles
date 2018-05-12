var canvas = document.getElementById("canvas");
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

window.onresize = resizeCanvas;

resizeCanvas();

var musicManager = new MusicManager();

var sceneManager = new SceneManager(canvas);
musicManager.onSongLoaded = () => { musicManager.play(); musicManager.seekTo(0) }
musicManager.onTimeUpdated = sceneManager.onSongTimeUpdate;

window.onclick = musicManager.togglePlayback;

// start button, overcome audio autoplay limitation introduced in chrome v66
var startPanel = document.getElementById("startPanel");
var startButton = document.getElementById("startButton");

startButton.addEventListener("click", onStartClicked);

function onStartClicked() {
    startButton.removeEventListener("click", onStartClicked );

    musicManager.startButtonClicked()
    .then( () => {
        startPanel.classList.add("fade");
        musicManager.loadSong('https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/brokenmantra.mp3?alt=media&token=40efea14-6084-4c72-b3c9-757ad871a4bc') })
}
// --

render();

window.onmousemove = onMouseMove;

function render() {
    requestAnimationFrame(render);
    sceneManager.update(musicManager);
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