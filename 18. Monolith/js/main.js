const canvas = document.getElementById("canvas");

const eventBus = new EventBus()
const sceneManager = new SceneManager(canvas);

bindEventListeners();
render();

function startGame() {
	const instructions = document.getElementById("instructionsContainer");
	instructions.classList.add("fade");

	const countDownContainer = document.getElementById("countDownContainer");
	countDownContainer.classList.remove("fade");

	sceneManager.introScreenClosed();

	setTimeout( () => { 
		countDownContainer.innerText = "3"

		const start = document.getElementById("startButton")
		instructions.removeChild(start)

	}, 1000)

	setTimeout( () => countDownContainer.innerText = "2", 2000)
	setTimeout( () => countDownContainer.innerText = "1", 3000)
	setTimeout( () => { 
		countDownContainer.innerText = "0"
		eventBus.post(startCountDownFinishedEvent)
	}, 4000)

	setTimeout( () => {
		const htmlContainer = document.getElementById("htmlContainer")
		htmlContainer.parentNode.removeChild(htmlContainer);
	}, 4300)
}

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

function render(time) {
	requestAnimationFrame(render);
	TWEEN.update(time);
    sceneManager.update();
}