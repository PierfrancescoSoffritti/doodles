function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

function toDeg(rad) {
    return rad * (180 / Math.PI);
}

function sin(val) {
    return Math.sin(val);
}

function cos(val) {
    return Math.cos(val);
}

function cartesianToPolar(x, y) {
    let radius = Math.sqrt( Math.pow(x, 2) + Math.pow(y, 2) )
    let angle = Math.atan( y / x )
    
    if(x < 0 && y > 0)
        angle += Math.PI
    else if(x < 0 && y < 0)
        angle += Math.PI
    else if(x > 0 && y < 0)
        angle += Math.PI*2

    return { radius, angle }
}

function polarToCartesian(radius, angle) {
    const x = radius * cos(angle)
    const y = radius * sin(angle)

    return { x, y }
}

function StepBarrier(steps, onDone, onStep) {
    
    let stepCounter = 0

    this.step = function() {
        stepCounter++

        if(onStep)
            onStep(stepCounter, steps)

        if(stepCounter === steps)
            onDone()
    }
}