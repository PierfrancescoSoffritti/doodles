function BackgroundTuneGenerator(notesGenerator) {
	
	let fastTime = false;
	let interval, interval2;

	setInterval( function() {
		const waveForm = Math.random() > 0.5 ? 1 : 2;
		notesGenerator.playBackgroundNoteWithDistr(waveForm, .06, 3);
	}, 1000);

	eventBus.subscribe(toggleTime, () => {
		fastTime = !fastTime;

		if(fastTime) {
			interval = setInterval( function() {
				const waveForm = Math.random() > 0.5 ? 1 : 2;
				notesGenerator.playBackgroundNoteWithDistr(waveForm, .06, 3);
			}, 300);

			interval2 = setInterval( function() {
				const waveForm = Math.random() > 0.5 ? 1 : 2;
				notesGenerator.playBackgroundNoteWithDistr(waveForm, .06, 1);
			}, 3000);			
		} else {
			clearInterval(interval);
			clearInterval(interval2);
		}

	});
}