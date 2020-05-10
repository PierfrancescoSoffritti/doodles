function onLoad() {
  window.onresize = onResize

  const canvas = document.getElementById("canvas")
  const screenInfo = {
    pixelRatio: getPixelRatio(canvas.getContext('2d')),
    width: -1,
    height: -1
  }
  
  resizeCanvas()
  
  const flow = new Flow(canvas, screenInfo)
  let time = 0
  render()

  function render() {
    if (time > 20) {
      flow.update()
    }
    requestAnimationFrame(render)
    time += 1
  }

  function onResize() {
    resizeCanvas()
    flow.onWindowResize()
  }

  function resizeCanvas() {
    const width = window.innerWidth * screenInfo.pixelRatio
    const height = window.innerHeight * screenInfo.pixelRatio

    canvas.style.width = window.innerWidth + "px"
    canvas.style.height = window.innerHeight + "px"

    canvas.setAttribute('width', Math.round(width))
    canvas.setAttribute('height', Math.round(height))

    screenInfo.width = width
    screenInfo.height = height
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