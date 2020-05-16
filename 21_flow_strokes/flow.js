
function Flow(canvas, screenInfo) {
  const context = canvas.getContext("2d")

  noise.seed(Math.random())

  const palette = getRandomPalette()
  const borderXFactor = 4
  const borderYFactor = 4
  const circlesOffset = 100
  const particlesSize = 1800

  let particles = getParticles()
  let circles = getCircles()

  function getParticles() {
    const borderX = screenInfo.width / borderXFactor //400
    const borderY = screenInfo.height / borderYFactor // 400
    const particles = []
    for (let y = borderY; y < screenInfo.height - borderY; y += 50) {
      const row = []
      for (let x = borderX; x < screenInfo.width - borderX; x += 40) {
        const strokeLength = getRandomStrokeLength()
        const strokeWidth = strokeLength/20
        const color = getRandomColor(palette.colors)
        row.push( { x, y, vx: 0, vy: 0, strokeLength, strokeWidth, color } )
      }
      particles.push(row)
    }

    return particles
  }

  function getCircles() {
    const circles = []
    const borderX = screenInfo.width / borderXFactor //400
    const borderY = screenInfo.height / borderYFactor // 400
    const offset = circlesOffset
    for (let i = 0; i < 12; i++) {
      const randx = Math.random()
      const randy = Math.random()

      let x
      if (randx > 0.5) {
        x = getRandom(borderX - offset, borderX)
      } else {
        x = getRandom(screenInfo.width - (borderX), screenInfo.width - borderX + offset)
      }

      // let y
      if (randy > 0.5) {}

      const y = getRandom(borderY - offset, screenInfo.height - borderY + offset)
      const rad = getRandom(1, 12)
      const color = getRandomColor(palette.colors)
      const fill = Math.random() > 0.5
      const strokeWidth = getRandom(1, 6)
      circles.push( { x, y, rad, fill, color, strokeWidth} )
    }
    return circles
  }

  function getRandomStrokeLength() {
    //const dim = Math.min(screenInfo.height, screenInfo.width)
    const dim = particlesSize

    const rand = Math.random()
    if(rand > 0.9) {
      return getRandom(dim/60, dim/40)
    } else if(rand > 0.5) {
      return getRandom(dim/20, dim/10)
    } else if (rand > 0.2) {
      return getRandom(dim/10, dim/6)
    } else {
      return getRandom(dim/8, dim/4)
    }
  }

  function getRandomColor(colors) {
    const rand = Math.random()
    if (rand > 0) {
      return colors[getRandomInt(0, colors.length-1)]
    } else {
      return colors[getRandomInt(0, colors.length-2)]
    }
  }

  function getRandomPalette() {
    const palettes = [
      // { colors: [ "#120136ee", "#035aa6ee", "#40bad5ee", "#fcbf1eee" ], background: "#B3DBF5" },
      { colors: [ "#162447ee", "#1f4068ee", "#1b1b2fee", "#e43f5aee" ], background: "#f7d6e0" },
      { colors: [ "#f6eedfee", "#f57b51ee", "#d63447ee", "#ffd31dee" ], background: "#001845" },
      { colors: [ "#095B6Eee", "#79C4D4ee", "#D6E4E2ee", "#C04F5Fbb" ], background: "#409AA4" },
      { colors: [ "#f57b51ee", "#2a9d8fee", "#f57b51ee", "#ffd31dee" ], background: "#0D171B" },
      { colors: [ "#caf0f8ee", "#90e0efee", "#00b4d8ee", "#0077b6ee" ], background: "#0D171B" },
    ]

    return palettes[getRandomInt(0, palettes.length-1)]
  }

  drawBackground(palette.background)
  renderParticles()
  renderCircles()

  this.update = function() {
  }

  this.onWindowResize = function() {
    particles = getParticles()
    circles = getCircles()

    drawBackground(palette.background)
    renderParticles()
    renderCircles()
  }

  function renderCircles() {
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i]
      drawCircle(c.x, c.y, c.rad, c.color, c.fill, c.strokeWidth)
    }
  }

  function renderParticles() {
    for (let x = 0; x < particles.length; x++) {
      for (let y = 0; y < particles[0].length; y++) {
        const p = particles[x][y]
        let prevP = null
        if (x > 0) prevP = particles[x-1][y]
        
        const angle = getValue(p.x, p.y, 0)

        if (prevP != null) {
          const prevAngle = getValue(prevP.x, prevP.y, 0)
          const delta = angle - prevAngle
          if (Math.abs(delta) > Math.PI / 80) {
            p.strokeWidth *= 2
            p.strokeLength /= 2
          } else {
            p.strokeWidth *= 1.5
            p.strokeLength /= 1.5
          }
        } else {
          p.strokeWidth *= 1.5
          p.strokeLength /= 1.5
        }

        const startX = ( Math.cos(angle) * (-p.strokeLength/2) ) + p.x
        const startY = ( Math.sin(angle) * (-p.strokeLength/2) ) + p.y
        
        p.vx = ( Math.cos(angle) * p.strokeLength/2 )
        p.vy = ( Math.sin(angle) * p.strokeLength/2 )
    
        const endX = p.x + p.vx
        const endY = p.y + p.vy
        
        context.lineWidth = p.strokeWidth
        context.beginPath()
        context.moveTo(startX, startY)
        context.lineTo(endX, endY)
        context.strokeStyle = p.color
        context.stroke()
      }
    }
  }

  function drawBackground(color) {
    context.fillStyle = color
    context.fillRect(0, 0, screenInfo.width, screenInfo.height)
  }

  function drawCircle(x, y, rad, color, fill, strokeWidth) {
    context.fillStyle = color
    context.strokeStyle = color
    context.beginPath()
    context.arc(x, y, rad, 0, 2 * Math.PI)
    if (fill) {
      context.fill()
    } else {
      context.lineWidth = strokeWidth
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
        context.strokeStyle = "#FFF"
        context.stroke()
  
        context.restore()
      }
    }
  }
  
  function getValue(x, y, z) {
    // values are from [-1, 1], shift by one ([0, 2]) and multiply by PI
    return (noise.simplex3(x / 4000, y / 4000, z) + 1) * Math.PI
  }
}