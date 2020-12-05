function getNearestTo(point, candidates) {
  const randIdx = getRandomInts(4, 0, candidates.length-1)
    
  let minDistance = Number.MAX_VALUE
  let closestPointIdx = -1
  
  randIdx.forEach(i => {
    const dist = getDistance(point, candidates[i])
    if (dist < minDistance) {
      closestPointIdx = i
      minDistance = dist
    }
  })
  return closestPointIdx
}

function getFurthestTo(point, candidates) {
  const randIdx = getRandomInts(10, 0, candidates.length-1)
  
  let maxDistance = -1
  let furthestPointIdx = -1
  
  randIdx.forEach(i => {
    const dist = getDistance(point, candidates[i])
    if (dist > maxDistance) {
      furthestPointIdx = i
      maxDistance = dist
    }
  })

  return furthestPointIdx
}

function pickSimilarColor(targetColor, unusedColors) {
  const randIdx = getRandomInts(400, 0, unusedColors.length-1)

  let bestRandIdx = -1
  let bestDx = Number.MAX_VALUE
  let bestMatch = { r: -1, g: -1, b: -1}
  for (let i=0; i<randIdx.length; i++) {
    const idx = randIdx[i]
    const color = unusedColors[idx]
    let dx = compareColors(targetColor, color)
    if (dx < bestDx) {
      bestRandIdx = idx
      bestDx = dx
      bestMatch = color
    }
  }

  swap(unusedColors, bestRandIdx, unusedColors.length-1)
  unusedColors.length -= 1

  return bestMatch
}

function getAvgSurrandingColor(point, output) {
  const adjPositions = getAdjacentPositions(point).filter(p => output[p.x][p.y] != -1)
  const colors = adjPositions.map(p => output[p.x][p.y])
  if (output[point.x][point.y] != -1) {
    colors.push(output[point.x][point.y])
  }

  return avgColor(colors)
}

function expandCandidates(candidates, point, pointIdx, visited) {
  if(!contains(candidates, point)) {
    console.error("candidates does not contain point")
    return candidates
  }

  const adjPositions = getAdjacentPositionsFast(point).filter(p => visited[p.x][p.y] != true)
  adjPositions.forEach(p => visited[p.x][p.y] = true)
  
  removeFromArray(candidates, pointIdx)
  union(candidates, adjPositions)
}

function drawImage(p5, pixels) {
  for (let x=0; x<pixels.length; x++) {
    for (let y=0; y<pixels[0].length; y++) {
      drawPixel(p5, { x, y }, pixels[x][y])
    }
  }
}

function drawPixel(p5, position, color) {
  p5.fill(color.r, color.g, color.b)
  p5.rect(position.x, position.y, 1)
}