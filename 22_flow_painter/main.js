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

  const images = [
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fvan_gogh_p2.jpg?alt=media&token=83b68a01-7d1c-4c3f-9a37-2bb6dee6d964", 
      bg: "#E9B0B6", 
      border: 70 
    },
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fvan_gogh_p1.jpg?alt=media&token=c69e6518-1a14-41f6-87da-02a4ad36a30f", 
      bg: "#C4E4FF",
      border: 70 
    },
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fvan_gogh_c.jpg?alt=media&token=21d33c0f-21b0-48e6-8ea7-4bdf0bd6749e",
      bg: "#FFF5D5", 
      border: 150 
    },
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fvan_gogh_s.jpg?alt=media&token=b86d2f42-7ac8-4a29-aa45-6a9ca7bb2c77",
      bg: "#FFDBDB",
      border: 150
    },
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fpink_guy.jpg?alt=media&token=51a6aed9-0800-4915-9129-1b998e1dbae4", 
      bg: "#D1ECFF",
      border: 150
    }
  ]
  let i = 0
  
  let flow = new Flow(canvas, imageCanvas, screenInfo, images[i])
  let time = 0
  render()

  document.addEventListener('keyup', e => { 
    // arrow right
    if (e.keyCode === 39) {
      i += 1
      i %= images.length
      flow = new Flow(canvas, imageCanvas, screenInfo, images[i])
    }
  })

  document.addEventListener('touchend', e => {
    i += 1
    i %= images.length
    flow = new Flow(canvas, imageCanvas, screenInfo, images[i])
  }, false)

  function render() {
    if (time > 10) {
      flow.update()
    }
    requestAnimationFrame(render)
    time += 1
  }

  function onResize() {
    resizeCanvas()
    time = 0
    flow = new Flow(canvas, imageCanvas, screenInfo, images[i])
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