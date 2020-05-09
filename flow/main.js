
const canvas = document.getElementById("canvas")
const context = canvas.getContext("2d")

const pixelRatio = getPixelRatio(context)

const width = window.innerWidth * pixelRatio
const height = window.innerHeight * pixelRatio

canvas.setAttribute('width', Math.round(width));
canvas.setAttribute('height', Math.round(height));

noise.seed(Math.random());

const particles = []
// bottom left top right
// for(let x = -width/2; x < width + (width/2); x += 6) {
//   particles.push( { x, y: getY(x), vx: 0, vy: 0, speed: Math.random()*2, color: getRandomColor(), dir: getRandomSign() } )
// }

// left side
// for(let y = 0; y < height; y += 2) {
//   particles.push( { x: 400, y: y, vx: 0, vy: 0, speed: Math.random()*2, color: getRandomColor(), dir: getRandomSign() } )
// }

// circle
for (let angle = 0; angle < Math.PI * 2; angle += 0.001) {
  const x = 400 * Math.cos(angle)
  const y = 400 * Math.sin(angle)
  particles.push( { x: x + width/2, y: y + height/2, vx: 0, vy: 0, speed: getRandomSpeed(), color: getRandomColor(), dir: getRandomSign() } )
}

for (let i = 0; i < particles.length; i++) {
  const p = particles[i]
  p.xStart = p.x
  p.yStart = p.y
}

drawCircle()
renderParticles()
// renderField()

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

function drawCircle() {
  context.fillStyle = "#FFFFFF";
  context.beginPath();
  context.arc(width/2, height/2, 400, 0, 2 * Math.PI);
  // context.lineWidth = 4
  // context.stroke()
  context.fill();
}

function getY(x) {
  const normalized = ((x / width) * -1) + 1
  return normalized * height
}

function getRandomSign() {
  return (Math.random() - 0.5) > 0 ? 1 : -1
}

function getRandomColor() {
  // const palette = ["#202C39", "#283845", "#B8B08D", "#F2D492", "#F29559"]
  // const index = Math.floor(Math.random() * palette.length)
  // return palette[index]

  return Math.random() /2
}

function renderParticles() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    if (p.isDead) continue
    const angle = getValue(p.x, p.y, 0)

    const startX = p.x
    const startY = p.y
    
    p.vx = Math.cos(angle) 
    p.vy = Math.sin(angle)

    p.x += p.vx * p.speed
    p.y += p.vy * p.speed

    if (isOutsideCircle(p)) {
      if (isPointNearStart(p)) {
        p.isDead = true
      }

      p.x = p.xStart
      p.y = p.yStart
      p.vx = 0
      p.vy = 0
      // p.color = 0.6
      p.speed = p.speed / 1.5
      continue
    }

    context.lineWidth = .9
    context.beginPath()
    context.moveTo(startX, startY)
    context.lineTo(p.x, p.y)
    context.strokeStyle = `rgba(0, 0, 0, ${p.color})`
    // context.strokeStyle = p.color
    context.stroke()
  }

  requestAnimationFrame(renderParticles)
}

function isPointNearStart(p) {
  const x = p.x - p.xStart
  const y = p.y - p.yStart
  const distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
  return distance < 5
}

function isOutsideCircle(p) {
  const radius = Math.sqrt(Math.pow(p.x - width/2, 2) + Math.pow(p.y - height/2, 2))
  return radius > 400
}

function renderField() {
  const segmentLenght = 4
  const resolution = 10

  for (let x = 0; x < width; x += resolution) {
    for (let y = 0; y < height; y += resolution) {
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

function getValue(x, y, z) {
  return (noise.simplex3(x / 4000, y / 4000, z) + 1) * Math.PI
  //return (x + y) * 0.01 * Math.PI * 2
}

/**
 * [getPixelRatio Given a canvas 2D context returns a pixel ratio]
 * @param  {[canvas context]} context [convas 2D context]
 * @return {[number]}         [pixelRatio]
 */
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