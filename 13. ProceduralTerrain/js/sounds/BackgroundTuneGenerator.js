function BackgroundTuneGenerator(notesGenerator) {
	
	setInterval( function() {
		const waveForm = Math.random() > 0.5 ? 1 : 2;
		notesGenerator.playBackgroundNoteWithDistr(waveForm, .06, 3);
	}, 1000);
}