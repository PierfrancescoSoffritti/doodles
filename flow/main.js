function onLoad() {
  const canvas = document.getElementById("canvas")
  window.onresize = resizeCanvas

  const screenInfo = {
    pixelRatio: getPixelRatio(canvas.getContext('2d')),
    width: -1,
    height: -1
  }
  
  resizeCanvas()
  const sceneManager = new SceneManager(canvas, screenInfo)
  render()

  function render() {
    sceneManager.update()
    requestAnimationFrame(render)
  }

  function resizeCanvas() {
    canvas.style.width = window.innerWidth + "px"
    canvas.style.height = window.innerHeight + "px"

    var width = window.innerWidth * state.pixelRatio
    var height = window.innerHeight * state.pixelRatio

    canvas.setAttribute('width', Math.round(width))
    canvas.setAttribute('height', Math.round(height))

    state.width = width
    state.height = height

    sceneManager.onWindowResize()
    sceneManager.update()
  }

  function getPixelRatio(context) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const backingStoreRatio = context.webkitBackingStorePixelRatio ||
        context.mozBackingStorePixelRatio ||
        context.msBackingStorePixelRatio ||
        context.oBackingStorePixelRatio ||
        context.backingStorePixelRatio || 
        1;

    return devicePixelRatio / backingStoreRatio;
  }
}