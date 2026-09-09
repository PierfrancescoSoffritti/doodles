// Use a deadline rather than rounding frame deltas: 30/60 fps stay steady on 120 Hz displays.
export class FramePacer {
	constructor() { this.next = 0; this.fps = null; }
	accept(now, fps) {
		if (fps !== this.fps) { this.fps = fps; this.next = now; }
		if (!fps) return true;
		const interval = 1000 / fps;
		if (now < this.next - .5) return false;
		this.next += interval;
		if (this.next < now - interval) this.next = now + interval;
		return true;
	}
	reset() { this.next = 0; this.fps = null; }
}
