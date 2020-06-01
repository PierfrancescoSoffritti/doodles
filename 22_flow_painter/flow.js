
function Flow(canvas, imageCanvas, screenInfo, image) {
  const context = canvas.getContext('2d')
  const imageCanvasContext = imageCanvas.getContext('2d')

  noise.seed(Math.random())

  drawBackground(imageCanvasContext, image.bg)
  drawBackground(context, image.bg)

  let particles = []
  let imageData

  loadImage(image.image, () => { 
    imageData = imageCanvasContext.getImageData(0, 0, screenInfo.width, screenInfo.height).data
    particles = getParticles()
   })

  border = image.border * screenInfo.pixelRatio

  function loadImage(imageUrl, onLoad) {
    const image = new Image()
    image.crossOrigin = "Anonymous"
    image.onload = () => {
      let imageWidth = image.width
      let imageHeight = image.height
      const wantedHeight = screenInfo.height - (border*2)
      const wantedWidth = screenInfo.width - (border*2)
      const scaleHeight = imageHeight / wantedHeight
      const scaleWidht = imageWidth / wantedWidth
      const scale = Math.max(scaleHeight, scaleWidht)

      imageWidth /= scale
      imageHeight /= scale

      const offsetX = (screenInfo.width  / 2) - (imageWidth  / 2)
      const offsetY = (screenInfo.height / 2) - (imageHeight / 2)

      imageCanvasContext.drawImage(image, offsetX, offsetY, imageWidth, imageHeight)
      onLoad()
    }
    image.src = imageUrl
  }

  const prtCount = (screenInfo.width * screenInfo.height) / 1000
  const noiseScale = prtCount/ (screenInfo.pixelRatio*1.1)

  function getParticles() {
    const particles = []
    for (let i = 0; i < prtCount; i++) {
      const x = getRandom(0, screenInfo.width)
      const y = getRandom(0, screenInfo.height)
      const color = getImageColor(x, y)
      const lifespan = getRandom(20, 80)
      const agingFactor = getRandom(2, 16)
      const speed = getRandom(1, 4)
      particles.push( { x, y, vx: 0, vy: 0, color, initialLifespan: lifespan, lifespan, lineWidth: lifespan/3, speed, agingFactor } )
    }

    return particles
  }

  this.update = function() {
    renderParticles()
  }

  this.onWindowResize = function() { }

  const minLifespan = 10 * screenInfo.pixelRatio

  function renderParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]

      if (p.lifespan <= 0) {
        p.x = getRandom(0, screenInfo.width)
        p.y = getRandom(0, screenInfo.height)
        p.vx = 0
        p.vy = 0
        p.color = getImageColor(p.x, p.y)
        p.lifespan = p.initialLifespan/1.1
        p.lineWidth = p.lifespan/3

        p.speed = p.speed / 1.05
        if (p.speed < 1) p.speed = 1

        p.initialLifespan -= p.agingFactor
        if (p.initialLifespan < minLifespan) p.initialLifespan = minLifespan
      }
      
      const angle = getValue(p.x, p.y, 0)
  
      const startX = p.x
      const startY = p.y
      
      p.vx = Math.cos(angle)  * p.speed
      p.vy = Math.sin(angle) * p.speed
  
      p.x += p.vx
      p.y += p.vy
  
      context.lineWidth = p.lineWidth
      context.beginPath()
      context.moveTo(startX, startY)
      context.lineTo(p.x, p.y)
      context.strokeStyle = `rgb(${p.color[0]}, ${p.color[1]}, ${p.color[2]})`
      context.stroke()

      p.lifespan -= 1
    }
  }

  function getImageColor(x, y) {
    x = Math.floor(x)
    y = Math.floor(y)
    const i = y * (screenInfo.width * 4) + x * 4
    return [ imageData[i], imageData[i+1], imageData[i+2] ]
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
    return (noise.simplex3(x / noiseScale, y / noiseScale, z) + 1) * Math.PI
  }
}