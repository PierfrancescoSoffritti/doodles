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
      image: "van_gogh_p2.jpg", 
      bg: "#E9B0B6", 
      border: 70 
    },
    { 
      image: "van_gogh_p1.jpg", 
      bg: "#C4E4FF",
      border: 70 
    },
    { 
      image: "van_gogh_c.jpg",
      bg: "#FFF5D5", 
      border: 150 
    },
    { 
      image: "van_gogh_s.jpg",
      bg: "#FFDBDB",
      border: 150
    },
    { 
      image: "pink_guy.jpg", 
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