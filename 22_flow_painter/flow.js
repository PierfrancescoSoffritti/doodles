
function Flow(canvas, imageCanvas, screenInfo) {
  const context = canvas.getContext('2d')
  const imageCanvasContext = imageCanvas.getContext('2d')

  noise.seed(Math.random())

  const images = [
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fvan_gogh_p2.jpg?alt=media&token=83b68a01-7d1c-4c3f-9a37-2bb6dee6d964", 
      bg: "#E9B0B6", 
      border: 100 
    },
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fvan_gogh_p1.jpg?alt=media&token=c69e6518-1a14-41f6-87da-02a4ad36a30f", 
      bg: "#C4E4FF",
      border: 100 
    },
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fvan_gogh_c.jpg?alt=media&token=21d33c0f-21b0-48e6-8ea7-4bdf0bd6749e",
      bg: "#FFF5D5", 
      border: 250 
    },
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fvan_gogh_s.jpg?alt=media&token=b86d2f42-7ac8-4a29-aa45-6a9ca7bb2c77",
      bg: "#FFDBDB",
      border: 250
    },
    { 
      image: "https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/22_flow_painter%2Fpink_guy.jpg?alt=media&token=51a6aed9-0800-4915-9129-1b998e1dbae4", 
      bg: "#D1ECFF",
      border: 250
    }
  ]

  const image = images[getRandomInt(0, images.length-1)]

  drawBackground(imageCanvasContext, image.bg)
  drawBackground(context, image.bg)

  let particles = []
  let imageData

  loadImage(image.image, () => { 
    imageData = imageCanvasContext.getImageData(0, 0, screenInfo.width, screenInfo.height).data
    particles = getParticles()
   })

  border = image.border

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
        if (p.initialLifespan < 10) p.initialLifespan = 10
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