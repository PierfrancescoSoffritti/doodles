// Locomotion runs on the fixed simulation clock. The GPU receives continuous
// stroke phases and muscle effort, never time multiplied by a changing frequency.
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
