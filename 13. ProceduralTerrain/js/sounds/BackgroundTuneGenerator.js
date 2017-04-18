function BackgroundTuneGenerator(notesGenerator) {
	
	setInterval( function() {
		const waveForm = Math.random() > 0.5 ? 1 : 3;
		notesGenerator.playNote(waveForm, .01, 3, true);
	}, 1000);
}