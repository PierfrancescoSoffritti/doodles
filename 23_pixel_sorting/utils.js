function swap(array, i1, i2) {
  const temp = array[i1]
  array[i1] = array[i2]
  array[i2] = temp
}

function getRandomInts(count, low, high) {
  const randInts = []
  while (randInts.length < count) {
    randInts.push(getRandomInt(low, high))
  }
  return randInts
}

function compareColors(c1, c2) {
  let dr = c1.r - c2.r
  let dg = c1.g - c2.g
  let db = c1.b - c2.b
  return Math.sqrt(Math.pow(dr, 2) + Math.pow(dg, 2) + Math.pow(db, 2))
}

function avgColor(colors) {
  let sumR = 0, sumG = 0, sumB = 0
  for (let i=0; i<colors.length; i++) {
    sumR += colors[i].r
    sumG += colors[i].g
    sumB += colors[i].b
  }

  return { r: sumR / colors.length, g: sumG / colors.length, b: sumB / colors.length }
}

function getAdjacentPositionsFast(point) {
  let indices = []
  // left
  if (point.x > 0) indices.push({ x: point.x - 1, y: point.y })
  // top
  if (point.y > 0) indices.push({ x: point.x, y: point.y - 1 })
  // right
  if (point.x < sizeX - 1) indices.push({ x: point.x + 1, y: point.y })
  // bottom
  if (point.y < sizeY - 1) indices.push({ x: point.x, y: point.y + 1 })

  return indices
}
  
function getAdjacentPositions(point) {
  let indices = []
  // left
  if (point.x > 0) indices.push({ x: point.x - 1, y: point.y })
  // top
  if (point.y > 0) indices.push({ x: point.x, y: point.y - 1 })
  // right
  if (point.x < sizeX - 1) indices.push({ x: point.x + 1, y: point.y })
  // bottom
  if (point.y < sizeY - 1) indices.push({ x: point.x, y: point.y + 1 })

  // diagonals
  if (point.x < sizeX - 1) {
    // bottom right
    if (point.y < sizeY - 1) indices.push({ x: point.x + 1, y: point.y + 1 })
    // top right
    if (point.y > 0) indices.push({ x: point.x + 1, y: point.y - 1 })
  }
  if (point.x > 0) {
    // bottom left
    if (point.y < sizeY - 1) indices.push({ x: point.x - 1, y: point.y + 1 })
    // top left
    if (point.y > 0) indices.push({ x: point.x - 1, y: point.y - 1 })
  }

  return indices
}
  
function union(a1, a2) {  
  a2
  .filter(p => !contains(a1, p))
  .forEach(p => a1.push(p))
}
  
function contains(array, point) {
  return array.some(p => pointEq(p, point))
}
  
function removeFromArray(array, idx) {
  if (idx >= 0) {
    swap(array, idx, array.length-1)
    array.length -= 1
  }
}
  
function pointEq(p1, p2) {
  return p1.x == p2.x && p1.y == p2.y
}

function getRandomInt(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
}

function createMatrix(width, height, defaultValue) {
  const matrix = []
  for(let i=0; i<width; i++) {
    matrix[i] = new Array(height).fill(defaultValue)
  }
  return matrix
}