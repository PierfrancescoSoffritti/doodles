function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}