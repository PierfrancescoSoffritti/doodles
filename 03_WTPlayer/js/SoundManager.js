function SoundManager () {
	var self = this;

	this.context;
	try {
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		this.context = new AudioContext();
	} catch(e) {
		alert('Web Audio API is not supported in this browser');
	}
	this.analyser = this.context.createAnalyser();
	this.analyser.smoothingTimeConstant = 0.3;
    this.analyser.fftSize = 1024;

	this.song = new Array(2);
}

SoundManager.prototype.startButtonClicked = function() {
	self.context.resume().then( () => self.song[0].play() );
}

SoundManager.prototype.init = function(callback) {
	self = this;

	loadSong();

	// done loading
	callback();

	function loadSong() {
		self.song[0] = new Audio("https://firebasestorage.googleapis.com/v0/b/doodling-321e8.appspot.com/o/music%2Fanimalcollective_floridada.mp3?alt=media&token=e3680160-835b-4427-9e34-7b911429a229");
		self.song[0].crossOrigin = "anonymous";
		self.song[1] = self.context.createMediaElementSource(self.song[0]);

		// connect the analyser to the song changes
	  	self.song[1].connect(self.analyser);
	  	self.analyser.connect(self.context.destination);
	}
}

SoundManager.prototype.playPause = function() {
	playPause(this.song[0]);

	function playPause(audio) {
		
		// precondition
		if (typeof audio == 'undefined')
			throw new Error("SoundManager.playPause(): audio is undefined");

		if(audio.paused || audio.ended)
			audio.play()
		else 
			audio.pause();
	}
}

// returns the avg amp of the current song
SoundManager.prototype.getAverageAmplitude = function() {
	self = this;

	if(!this.analyser)
		return 0;

    var array = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(array);
    return calculateAverageAmplitude(array);

	function calculateAverageAmplitude(array) {
        var values = 0;
        var average;
 
        var length = array.length;
 
        // get all the frequency amplitudes
        for (var i = 0; i < length; i++)
            values += array[i];
 
        average = values / length;
        return average;
    }
}


//
// EXAMPLES:
//

/*

	pure WebAudio example

	try {
		// Fix up for prefixing
		window.AudioContext = window.AudioContext||window.webkitAudioContext;
		self.context = new AudioContext();
	} catch(e) {
		alert('Web Audio API is not supported in this browser');
	}

	var request = new XMLHttpRequest();
	request.open('GET', 'sounds/samp.mp3', true);
	request.responseType = 'arraybuffer';

	request.onload = function () {
		var undecodedAudio = request.response; 
		self.context.decodeAudioData(undecodedAudio, function (buffer) {
			// Create the AudioBufferSourceNode
			self.backgroundLoop = self.context.createBufferSource();
			self.backgroundLoop.loop = true;

			// Tell the AudioBufferSourceNode to use this AudioBuffer.
			self.backgroundLoop.buffer = buffer;
			self.backgroundLoop.connect(self.context.destination);
			self.backgroundLoop.start(self.context.currentTime);
		});
	};

	request.send();
	*/


	/*

	HTML5 <audio> example. Supports streaming ;)

	var audio = new Audio();
	audio.src = 'sounds/sound.mp3';
	audio.controls = true;
	audio.autoplay = true;
	audio.loop = true;
	document.body.appendChild(audio);

	var audio2 = new Audio();
	audio2.src = 'sounds/background.mp3';
	audio2.loop = true;
	document.body.appendChild(audio2);

	var audio3 = new Audio();
	audio3.src = 'sounds/samp.mp3';
	audio3.loop = true;
	document.body.appendChild(audio3);
	*/
	

	/*

	CreateJs example

	var soundID = "ID";
	createjs.Sound.on("fileload", handleLoad);
	createjs.Sound.registerSound("sounds/samp.mp3", soundID);
	

	function handleLoad(event) {
		createjs.Sound.play(soundID, {loop:-1});
		// store off AbstractSoundInstance for controlling
 	}

 	*/