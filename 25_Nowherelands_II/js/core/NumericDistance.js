// Numeric-only distances for hot simulation loops. Scaling before squaring
// keeps overflow/underflow protection while allowing the caller to inline the
// arithmetic instead of boxing arguments at a variadic builtin boundary.
// The operation order matches V8's two/three-argument Math.hypot paths:
// https://github.com/v8/v8/blob/main/src/builtins/math.tq
export function hypot2(x, y) {
 const a = Math.abs(x), b = Math.abs(y);
 if (a === Infinity || b === Infinity) return Infinity;
 const scale = Math.max(a, b);
 if (scale === 0) return 0;
 const u = a / scale, v = b / scale;
 return Math.sqrt(u * u + v * v) * scale;
}

export function hypot3(x, y, z) {
 const a = Math.abs(x), b = Math.abs(y), c = Math.abs(z);
 if (a === Infinity || b === Infinity || c === Infinity) return Infinity;
 const scale = Math.max(Math.max(a, b), c);
 if (scale === 0) return 0;
 const u = a / scale, v = b / scale, w = c / scale;
 const p = u * u, q = v * v;
 const correction = (p + q) - p - q;
 return Math.sqrt(p + q + (w * w - correction)) * scale;
}
