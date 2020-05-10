
function Flow(canvas, screenInfo) {
  const context = canvas.getContext("2d")
  const circleRadius = Math.min(screenInfo.height, screenInfo.width)/2.5

  noise.seed(Math.random())

  const particles = []
  for (let angle = 0; angle < Math.PI * 2; angle += 0.001) {
    const x = circleRadius * Math.cos(angle) + screenInfo.width/2
    const y = circleRadius * Math.sin(angle) + screenInfo.height/2
    const speed = getRandomSpeed()
    particles.push({ x, y, vx: 0, vy: 0, speed, xStart: x, yStart: y, speedStart: speed, color: Math.random()/2 })
  }

  drawBackground()
  // drawCircle()
  // renderField()

  this.update = function() {
    renderParticles()
  }

  this.onWindowResize = function() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      p.x = p.xStart
      p.y = p.yStart
      p.speed = p.speedStart
    }

    drawBackground()
  }

  function drawBackground() {
    context.fillStyle = "#000";
    context.fillRect(0, 0, screenInfo.width, screenInfo.height);
  }

  function drawCircle() {
    context.fillStyle = "#000";
    context.beginPath();
    context.arc(screenInfo.width/2, screenInfo.height/2, circleRadius, 0, 2 * Math.PI);
    context.fill();
  }

  function renderParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      
      if (p.skip) {
        continue
      }
      
      const angle = getValue(p.x, p.y, 0)
  
      const startX = p.x
      const startY = p.y
      
      p.vx = Math.cos(angle) 
      p.vy = Math.sin(angle)
  
      p.x += p.vx * p.speed
      p.y += p.vy * p.speed
  
      if (isOutsideCircle(p)) {
        if (isPointNearStart(p)) {
          p.skip = true
        }
  
        p.x = p.xStart
        p.y = p.yStart
        p.vx = 0
        p.vy = 0
        p.speed = p.speed / 1.5

        continue
      }
  
      context.lineWidth = .9
      context.beginPath()
      context.moveTo(startX, startY)
      context.lineTo(p.x, p.y)
      context.strokeStyle = `rgba(255, 255, 255, ${p.color})`
      context.stroke()
    }
  }

  function isOutsideCircle(p) {
    const radius = Math.sqrt(Math.pow(p.x - screenInfo.width/2, 2) + Math.pow(p.y - screenInfo.height/2, 2))
    return radius > circleRadius
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
        context.stroke()
  
        context.restore()
      }
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

function getValue(x, y, z) {
  return (noise.simplex3(x / 4000, y / 4000, z) + 1) * Math.PI
}