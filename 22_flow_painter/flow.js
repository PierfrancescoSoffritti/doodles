
function Flow(canvas, imageCanvas, screenInfo) {
  const context = canvas.getContext("2d")
  const imageCanvasContext = imageCanvas.getContext('2d')

  noise.seed(Math.random())

  drawBackground(imageCanvasContext, "#FFF")

  let particles

  loadImage(() => { particles = getParticles() })

  function loadImage(onLoad) {
    const image = new Image()
    image.onload = () => {
      imageCanvasContext.drawImage(image, canvas.width / 2 - image.width / 2, canvas.height / 2 - image.height / 2)
      onLoad()
    }
    image.src = "pink_guy2.jpg"
  }

  function getParticles(strokeSize) {
    const particles = []
    for (let i = 0; i < 2000; i++) {
      const x = getRandom(0, screenInfo.width)
      const y = getRandom(0, screenInfo.height)
      const color = getImageColor(x, y)
      particles.push( { x, y, vx: 0, vy: 0, color, strokeSize } )
    }

    // for (let y = 0; y < screenInfo.height; y += 50) {
    //   for (let x = 0; x < screenInfo.width; x += 40) {
    //     const color = getImageColor(x, y)
    //     particles.push( { x, y, vx: 0, vy: 0, color } )
    //   }
    // }

    return particles
  }

  function getImageColor(x, y) {
    const data = imageCanvasContext.getImageData(x, y, 1, 1).data
    const rgb = [ data[0], data[1], data[2] ]
    return rgb
  }

  // renderField()

  let duration = 0
  let maxDuration = 10
  let strokeSize = 100

  this.update = function() {
    if (duration > maxDuration) {
      duration = 0
      strokeSize -= 3
      if (strokeSize < 0) strokeSize = 3
      // maxDuration -= 1
      particles = getParticles(strokeSize)
    } else {
      renderParticles()
      duration += 1
    }
  }

  this.onWindowResize = function() {
  }

  function renderParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      
      const angle = getValue(p.x, p.y, 0)
  
      const startX = p.x
      const startY = p.y
      
      p.vx = Math.cos(angle) 
      p.vy = Math.sin(angle)
  
      p.x += p.vx
      p.y += p.vy
  
      context.lineWidth = p.strokeSize
      context.beginPath()
      context.moveTo(startX, startY)
      context.lineTo(p.x, p.y)
      context.strokeStyle = `rgb(${p.color[0]}, ${p.color[1]}, ${p.color[2]})`
      context.stroke()
    }
  }

  function renderField() {
    const segmentLenght = 4
    const resolution = 10
  
    for (let x = 0; x < screenInfo.width; x += resolution) {
      for (let y = 0; y < screenInfo.height; y += resolution) {
        const value = getValue(x, y, 0)
  
        const xStart = (-segmentLenght * Math.cos(value)) + x
        const yStart = (-segmentLenght * Math.sin(value)) + y
  
        const xEnd = (segmentLenght * Math.cos(value)) + x
        const yEnd = (segmentLenght * Math.sin(value)) + y
  
        context.lineWidth = .6
        context.beginPath()
        context.moveTo(xStart, yStart)
        context.lineTo(xEnd, yEnd)
        context.strokeStyle = "#000"
        context.stroke()
  
        context.restore()
      }
    }
  }

  function drawBackground(context, color) {
    context.fillStyle = color
    context.fillRect(0, 0, screenInfo.width, screenInfo.height)
  }
  
  function getValue(x, y, z) {
    // values are from [-1, 1], shift by one ([0, 2]) and multiply by PI
    return (noise.simplex3(x / 2000, y / 1000, z) + 1) * Math.PI
  }
}