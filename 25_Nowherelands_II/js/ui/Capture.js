// P once: screenshot. P twice: start / stop a video recording (canvas + audio).
// The frame is grabbed on the first press and only saved if no second press
// follows, so a screenshot shows the moment the key went down.

const DOUBLE_PRESS_MS = 320;
const VIDEO_TYPES = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

function save(blob, extension) {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = 'nowherelands-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + extension;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export class Capture {
	constructor(canvas, shared, hud) {
		this.canvas = canvas;
		this.shared = shared;
		this.hud = hud;
		this.recorder = null;
		this.wantFrame = false;
		this.shot = null;      // promise of the frame grabbed on the first press
		this.timer = null;
	}

	get recording() { return !!this.recorder && this.recorder.state === 'recording'; }

	press() {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null; this.shot = null; this.wantFrame = false;
			this.toggleRecording();
			return;
		}
		this.wantFrame = true;
		this.timer = setTimeout(() => {
			this.timer = null;
			const shot = this.shot; this.shot = null;
			if (shot) shot.then((blob) => { if (blob) { save(blob, 'png'); this.hud.flashCapture(); } });
		}, DOUBLE_PRESS_MS);
	}

	// Call right after the canvas has been drawn: without preserveDrawingBuffer
	// its pixels are only readable within the task that rendered them.
	presented() {
		if (!this.wantFrame) return;
		this.wantFrame = false;
		this.shot = new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
	}

	toggleRecording() {
		if (this.recording) { this.recorder.stop(); return; }
		if (!window.MediaRecorder || !this.canvas.captureStream) return;
		const stream = this.canvas.captureStream(60);
		const audio = this.shared.audio ? this.shared.audio.recordingStream() : null;
		if (audio) for (const track of audio.getAudioTracks()) stream.addTrack(track);
		const mimeType = VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
		const chunks = [];
		const recorder = this.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 20e6, audioBitsPerSecond: 256e3 });
		recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
		recorder.onstop = () => {
			for (const track of stream.getVideoTracks()) track.stop();
			this.hud.setRecording(false);
			const type = recorder.mimeType || mimeType || 'video/webm';
			save(new Blob(chunks, { type }), type.includes('mp4') ? 'mp4' : 'webm');
		};
		recorder.onerror = () => this.hud.setRecording(false);
		recorder.start(1000);
		this.hud.setRecording(true);
	}
}
