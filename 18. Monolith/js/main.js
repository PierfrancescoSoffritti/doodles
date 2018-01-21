const canvas = document.getElementById("canvas");

const sceneManager = new SceneManager(canvas);

bindEventListeners();
render();

function bindEventListeners() {
	window.onresize = resizeCanvas;
	window.onkeydown = onKeyDown;
	window.onkeyup = onKeyUp;
	window.onmousedown = onMouseDown;
	window.onmouseup = onMouseUp;
	window.oncontextmenu = event => event.preventDefault();

	resizeCanvas();	
}

function resizeCanvas() {
	canvas.style.width = '100%';
	canvas.style.height= '100%';
	
	canvas.width  = canvas.offsetWidth;
	canvas.height = canvas.offsetHeight;
    
    sceneManager.onWindowResize();
}

function onKeyDown(event) {
	sceneManager.onKeyDown(event.keyCode)
}

function onKeyUp(event) {
	sceneManager.onKeyUp(event.keyCode)
}

function onMouseDown(event) {
	sceneManager.onMouseDown(event)
}

function onMouseUp(event) {
	sceneManager.onMouseUp(event)
}

function render() {
    requestAnimationFrame(render);
    sceneManager.update();
}