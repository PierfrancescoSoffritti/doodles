function BackgroundTuneGenerator() {
	setInterval(function() {
		const waveForm = Math.random() > 0.5 ? 1 : 3;
		eventBus.post(tuneMonolithClick, waveForm, .1);
	}, 1000);
}