function onLoad() {
  const canvas = document.getElementById("canvas")
  window.onresize = resizeCanvas

  const screenInfo = {
    pixelRatio: getPixelRatio(canvas.getContext('2d')),
    width: -1,
    height: -1
  }
  
  let firstTime = true
  resizeCanvas()
  const flow = new Flow(canvas, screenInfo)
  render()

  function render() {
    flow.update()
    requestAnimationFrame(render)
  }

  function resizeCanvas() {
    canvas.style.width = window.innerWidth + "px"
    canvas.style.height = window.innerHeight + "px"

    var width = window.innerWidth * screenInfo.pixelRatio
    var height = window.innerHeight * screenInfo.pixelRatio

    canvas.setAttribute('width', Math.round(width))
    canvas.setAttribute('height', Math.round(height))

    screenInfo.width = width
    screenInfo.height = height

    if (firstTime == false) {
      flow.onWindowResize()
      flow.update()
    } else {
      firstTime = true
    }
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