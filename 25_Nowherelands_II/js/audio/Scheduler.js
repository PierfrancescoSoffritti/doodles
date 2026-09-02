// Lookahead scheduler on the audio clock ("a tale of two clocks").
export class Scheduler {
	constructor(ctx, bpm = 64, stepsPerBeat = 2) {
		this.ctx = ctx;
		this.bpm = bpm;
		this.stepsPerBeat = stepsPerBeat;
		this.lookahead = 0.14;
		this.interval = 25;
		this.step = 0;
		this.nextStepTime = 0;
		this.listeners = [];
		this.timer = null;
	}
	get stepDuration() { return 60 / this.bpm / this.stepsPerBeat; }
	get stepsPerBar() { return this.stepsPerBeat * 4; }

	onStep(fn) { this.listeners.push(fn); }

	start() {
		this.nextStepTime = this.ctx.currentTime + 0.1;
		this.timer = setInterval(() => this.tick(), this.interval);
	}
	stop() { clearInterval(this.timer); }

	tick() {
		while (this.nextStepTime < this.ctx.currentTime + this.lookahead) {
			const t = this.nextStepTime, step = this.step, dur = this.stepDuration;
			for (const fn of this.listeners) fn(step, t, dur);
			this.step++;
			this.nextStepTime += dur;
		}
	}

	// Next grid time at or after "now", for quantizing player input.
	quantize(subdivisions = 1) {
		const dur = this.stepDuration / subdivisions;
		const now = this.ctx.currentTime;
		let t = this.nextStepTime - this.stepDuration;
		while (t < now + 0.02) t += dur;
		return t;
	}
}
