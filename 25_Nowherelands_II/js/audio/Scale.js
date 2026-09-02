export const MODES = {
	pentMinor: [0, 3, 5, 7, 10],
	pentMajor: [0, 2, 4, 7, 9],
	dorian: [0, 2, 3, 5, 7, 9, 10],
	lydian: [0, 2, 4, 6, 7, 9, 11],
	aeolian: [0, 2, 3, 5, 7, 8, 10],
};

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Scale {
	constructor(root = 50, mode = 'pentMinor') {
		this.root = root;   // midi note of the tonic, octave 3
		this.mode = mode;
	}
	get intervals() { return MODES[this.mode]; }
	get length() { return this.intervals.length; }

	midi(degree, octaveOffset = 0) {
		const len = this.length;
		const oct = Math.floor(degree / len);
		const idx = ((degree % len) + len) % len;
		return this.root + this.intervals[idx] + 12 * (oct + octaveOffset);
	}
	freq(degree, octaveOffset = 0) { return midiToFreq(this.midi(degree, octaveOffset)); }

	// chord tones stacked on a root degree (stacked thirds in 7-note modes, open stacks in pentatonic)
	chordOn(root) { return (this.length === 5 ? [0, 1, 2, 4] : [0, 2, 4, 6]).map((d) => d + root); }
	chordDegrees() { return this.chordOn(this.chordRoot || 0); }
}
