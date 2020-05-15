
function Flow(canvas, screenInfo) {
  const context = canvas.getContext("2d")
  const circleRadius = Math.min(screenInfo.height, screenInfo.width)/2.5

  noise.seed(Math.random())

  const particles = []
  // for (let angle = 0; angle < Math.PI * 2; angle += 0.001) {
  //   const x = circleRadius * Math.cos(angle) + screenInfo.width/2
  //   const y = circleRadius * Math.sin(angle) + screenInfo.height/2
  //   const speed = getRandomSpeed()
  //   particles.push({ x, y, vx: 0, vy: 0, speed, xStart: x, yStart: y, speedStart: speed, alpha: Math.random()/2 })
  // }
  
  // for (let i = 0; i < 1500; i++) {
  //   const x = getRandom(0, screenInfo.width)
  //   const y = getRandom(0, screenInfo.height)
  //   const strokeLength = getRandomStrokeLength()
  //   const strokeWidth = getRandom(8, 24)
  //   const color = getRandomColor()
  //   particles.push( { x, y, vx: 0, vy: 0, strokeLength, strokeWidth, color } )
  // }

  const palette = getRandomPalette()

  const border = 400//Math.max(screenInfo.height, screenInfo.width) / 10
  for (let y = border; y < screenInfo.height - border; y += 40) {
    const row = []
    for (let x = border; x < screenInfo.width - border; x += 30) {
      const strokeLength = getRandomStrokeLength()
      // const strokeWidth = getRandomWidth()
      const strokeWidth = strokeLength/20
      const color = getRandomColor(palette)
      row.push( { x, y, vx: 0, vy: 0, strokeLength, strokeWidth, color } )
    }
    particles.push(row)
  }

  const circles = []
  const offset = 50//border/3
  for (let i = 0; i < 12; i++) {
    const randx = Math.random()
    const randy = Math.random()

    let x
    if (randx > 0.5) {
      x = getRandom(border - offset, border)
    } else {
      x = getRandom(screenInfo.width - (border), screenInfo.width - border + offset)
    }

    // let y
    if (randy > 0.5) {}

    const y = getRandom(border - offset, screenInfo.height - border + offset)
    const rad = getRandom(1, 12)
    const color = getRandomColor(palette)
    circles.push( { x, y, rad, color } )
  }

  function getRandomStrokeLength() {
    const dim = Math.min(screenInfo.height, screenInfo.width)
    // const minStrokeLen = dim/60
    // const maxStrokeLen = dim/6
    // return getRandom(minStrokeLen, maxStrokeLen)

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
  
  function getRandomWidth() {
    const rand = Math.random()
    if(rand > 0.9) {
      return getRandom(14, 20)
    } else if(rand > 0.5) {
      return getRandom(10, 12)
    } else if (rand > 0.2) {
      return getRandom(4, 6)
    } else {
      return getRandom(1, 2)
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
      [ "#120136ee", "#035aa6ee", "#40bad5ee", "#fcbf1eee" ],
      [ "#162447ee", "#1f4068ee", "#1b1b2fee", "#e43f5aee" ],
    ]

    return palettes[getRandomInt(0, palettes.length-1)]
  }

  drawBackground("#fff")
  //drawCircle()
  // renderField()

  renderParticles()
  renderCircles()

  this.update = function() {
    // renderParticles()
  }

  function renderCircles() {
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i]
      drawCircle(c.x, c.y, c.rad, c.color)
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
            
            // console.log(`prev: (${prevP.x}, ${prevP.y})  curr: (${p.x}, ${p.y})`)
            //console.log(angle +" - " +prevAngle +" = " +delta)
          } else {
            //p.strokeWidth /= 2
            p.strokeWidth *= 1.5
            p.strokeLength /= 1.5
          }
        } else {
          p.strokeWidth *= 1.5
          p.strokeLength /= 1.5
        }
    
        // const startX = p.x
        // const startY = p.y

        const startX = ( Math.cos(angle) * (-p.strokeLength/2) ) + p.x
        const startY = ( Math.sin(angle) * (-p.strokeLength/2) ) + p.y
        
        p.vx = ( Math.cos(angle) * p.strokeLength/2 )
        p.vy = ( Math.sin(angle) * p.strokeLength/2 )
    
        const endX = p.x + p.vx
        const endY = p.y + p.vy
    
        // p.strokeLength -= 1
    
        context.lineWidth = p.strokeWidth
        context.beginPath()
        context.moveTo(startX, startY)
        context.lineTo(endX, endY)
        context.strokeStyle = p.color
        context.stroke()
      }
    }
  }

  this.onWindowResize = function() {
  }

  function drawBackground(color) {
    context.fillStyle = color
    context.fillRect(0, 0, screenInfo.width, screenInfo.height)
  }

  function drawCircle(x, y, rad, color) {
    context.fillStyle = color
    context.beginPath()
    context.arc(x, y, rad, 0, 2 * Math.PI)
    context.fill()
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

  function getRandomSpeed() {
    const type = Math.random()
    if (type > 0.92) {
      return Math.random()*3
    } else if (type > 0.5) {
      return Math.random() * 1.5
    } else {
      return Math.random() * 0.5
    }
  }
  
  function isPointNearStart(p) {
    const x = p.x - p.xStart
    const y = p.y - p.yStart
    const distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
    return distance < 5
  }

  function isOutsideCircle(p) {
    const radius = Math.sqrt(Math.pow(p.x - screenInfo.width/2, 2) + Math.pow(p.y - screenInfo.height/2, 2))
    return radius > circleRadius
  }
  
  function getValue(x, y, z) {
    // values are from [-1, 1], shift by one ([0, 2]) and multiply by PI
    return (noise.simplex3(x / 4000, y / 4000, z) + 1) * Math.PI
  }
}