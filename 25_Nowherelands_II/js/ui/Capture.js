// P once: screenshot. P twice: start / stop a video recording (canvas + audio).
// The frame is grabbed on the first press and only saved if no second press
// follows, so a screenshot shows the moment the key went down.

import { openRecordingStore } from './RecordingStore.js';

const DOUBLE_PRESS_MS = 320;
const CHUNK_MS = 5000;
const PHOTO_COPY_MS = 5000;
const VIDEO_COPY_MS = 60000;
// Matroska first: hardware H.264 like MP4, but Chrome's MP4 muxer crashes the page once
// a take reaches 4 GiB (about a quarter of an hour here). `ffmpeg -i take.mkv -c copy take.mp4`
// rewraps one without re-encoding. MP4 stays last, for browsers that record nothing else.
const VIDEO_TYPES = [
	{ mimeType: 'video/x-matroska;codecs=avc1,opus', extension: 'mkv' },
	{ mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
	{ mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
	{ mimeType: 'video/webm', extension: 'webm' },
	{ mimeType: 'video/mp4', extension: 'mp4' },
];

function fileName(extension) {
	return 'nowherelands-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + extension;
}

// The browser does not say when it has finished copying the blob out, so it is given
// copyMs, a generous guess: the promise resolves after that, and the blob may then go.
function download(blob, name, copyMs) {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.click();
	return new Promise((resolve) => setTimeout(() => { URL.revokeObjectURL(a.href); resolve(); }, copyMs));
}

export class Capture {
	constructor(canvas, shared, hud) {
		this.canvas = canvas;
		this.shared = shared;
		this.hud = hud;
		this.store = openRecordingStore();
		this.recorder = null;
		this.phase = 'idle';   // idle -> starting -> recording -> stopping -> idle
		this.wantFrame = false;
		this.shot = null;      // promise of the frame grabbed on the first press
		this.timer = null;
	}

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
			if (shot) shot.then((blob) => {
				if (!blob) return;
				download(blob, fileName('png'), PHOTO_COPY_MS);
				this.hud.flashCapture();
			});
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
		if (this.phase === 'recording') this.recorder.stop();
		else if (this.phase === 'idle') this.startRecording();
	}

	async startRecording() {
		if (!window.MediaRecorder || !this.canvas.captureStream) return;
		this.phase = 'starting';
		let stream = null, take = null, name = null;
		try {
			stream = this.canvas.captureStream(60);
			const audio = this.shared.audio ? this.shared.audio.recordingStream() : null;
			if (audio) for (const track of audio.getAudioTracks()) stream.addTrack(track);
			const format = VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type.mimeType));
			if (!format) throw new Error('This browser cannot record video');
			const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 20e6, audioBitsPerSecond: 256e3 });
			name = fileName(format.extension);
			take = await (await this.store).begin(name, format.mimeType);
			if (!take) throw new Error('Another tab is recording');

			// However a recording ends (P P, a full take, an encoder error) it ends in onstop.
			const stop = () => { if (recorder.state !== 'inactive') recorder.stop(); };
			let full = false;
			recorder.ondataavailable = (e) => {
				if (full || !e.data.size) return;
				take.append(e.data).catch((error) => {
					full = true;
					this.hud.showToast('recording stopped', error.message.toLowerCase());
					stop();
				});
			};
			recorder.onerror = (e) => this.hud.showToast('recording stopped', (e.error ? e.error.message : 'recorder error').toLowerCase());
			recorder.onstop = () => this.finishRecording(stream, take, name);
			recorder.start(CHUNK_MS);
			this.recorder = recorder;
			this.phase = 'recording';
			this.hud.setRecording(true);
		} catch (error) {
			this.hud.showToast('recording unavailable', error.message.toLowerCase());
			this.finishRecording(stream, take, name);
		}
	}

	async finishRecording(stream, take, name) {
		this.phase = 'stopping';
		this.recorder = null;
		this.hud.setRecording(false);
		// the audio track belongs to the engine; only the canvas capture is ours to end
		if (stream) for (const track of stream.getVideoTracks()) track.stop();
		if (take) {
			let copied = Promise.resolve();
			try {
				const blob = await take.finish();
				if (blob.size) copied = download(blob, name, VIDEO_COPY_MS);
			} catch {
				this.hud.showToast('recording lost', 'it could not be written to disk');
			}
			copied.then(() => take.discard());
		}
		this.phase = 'idle';
	}
}
