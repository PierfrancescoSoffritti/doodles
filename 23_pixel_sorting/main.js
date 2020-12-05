function onLoad() {
  window.onresize = onResize

  const canvas = document.getElementById("canvas")
  const imageCanvas = document.getElementById("imageCanvas")
  const screenInfo = {
    pixelRatio: getPixelRatio(canvas.getContext('2d')),
    width: -1,
    height: -1
  }
  
  resizeCanvas()

  new Pixels(canvas, imageCanvas, screenInfo, "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/thumbnails%2F22_flow_painter.jpg?alt=media&token=7880266f-4270-4fa9-b408-59b2612cee7a")

  // let time = 0
  // render()

  // document.addEventListener('keyup', e => { 
  // })

  // document.addEventListener('touchend', e => {
  // }, false)

  // function render() {
  //   requestAnimationFrame(render)
  //   time += 1
  // }

  function onResize() {
    resizeCanvas()
    // time = 0
  }

  function resizeCanvas() {
    const width = window.innerWidth * screenInfo.pixelRatio
    const height = window.innerHeight * screenInfo.pixelRatio

    canvas.style.width = window.innerWidth + "px"
    canvas.style.height = window.innerHeight + "px"

    imageCanvas.style.width = window.innerWidth + "px"
    imageCanvas.style.height = window.innerHeight + "px"

    canvas.setAttribute('width', Math.round(width))
    canvas.setAttribute('height', Math.round(height))

    imageCanvas.setAttribute('width', Math.round(width))
    imageCanvas.setAttribute('height', Math.round(height))

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