const canvas = document.getElementById("canvas")

const stepBarrier = new StepBarrier(2, begin)

const eventBus = new EventBus()
const sceneManager = new SceneManager(canvas)
const domUIManager = new DomUIManager(eventBus)

cacheResources()
bindEventListeners()

function onload() {
    stepBarrier.step()
}

function cacheResources() {
	const loader = new THREE.JSONLoader()
	loader.load('models/spaceship.json', stepBarrier.step)
}

 function begin() {	
	domUIManager.showUI()
	render()
 }

function bindEventListeners() {
	window.onresize = resizeCanvas
	window.onkeydown = onKeyDown
	window.onkeyup = onKeyUp
	window.onmousedown = onMouseDown
	window.onmouseup = onMouseUp
	window.oncontextmenu = event => event.preventDefault()

	resizeCanvas()
}

function resizeCanvas() {
	canvas.style.width = '100%'
	canvas.style.height= '100%'
	
	canvas.width  = canvas.offsetWidth
	canvas.height = canvas.offsetHeight
    
    sceneManager.onWindowResize()
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
	requestAnimationFrame(render)
	TWEEN.update(time)
    sceneManager.update()
}