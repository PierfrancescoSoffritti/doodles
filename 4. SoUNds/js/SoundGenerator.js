function SoundGenerator() {
    // var audio = new Audio();
    // audio.src = "song2.mp3";
    // audio.load();

	var notesArray = getNotes();

    var context = new AudioContext();

    this.fftSize = 16384;
    var analyser = context.createAnalyser();
    analyser.smoothingTimeConstant = 0.7;
    analyser.fftSize = this.fftSize;

    var waveForm = "triangle";
    var fact = 1;

    $("body").keypress(event => {
        var i = getKeyIndex(event.key);

        var oscillator = context.createOscillator();
        oscillator.type = waveForm;
        oscillator.frequency.value = notesArray[i] * fact;

        var gain = context.createGain();

        // play from audio source
        // var mediaElementSource = context.createMediaElementSource(audio);
        // mediaElementSource.connect(analyser);
        // analyser.connect(context.destination);
        // audio.play();

        // generate sound
        oscillator.connect(gain);
        gain.connect(analyser);
        analyser.connect(context.destination);

        oscillator.start(0);
        gain.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + 1);
    })

    this.getByteFrequencyData = function() {
        if(!analyser) {
            // return an array of 0s
            var array = [this.fftSize/2];
            for(var i=0; i<array.length; i++)
                array[i] = 0;
            return array;
        }

        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        return array;
    }

    $("body").keyup(event => { 
        // change factor (octave ?)
        if(event.key == 'ArrowDown')
            fact--;
        if(event.key == 'ArrowUp')
            fact++;
        fact = fact > 3 ? 1 : fact;
        fact = fact < 1 ? 3 : fact;        

        waveForm = getWaveForm(event.key);

        console.log("fact: " +fact +" WaveForm: " +waveForm);
    })

    function getWaveForm(key) {
        switch(key) {
            case '1': return "sine";
            case '2': return "square";
            case '3': return "triangle";
            case '4': return "sawtooth";
            default: return waveForm;
        }
    }

    function getKeyIndex(key) {
        switch(key) {
            case 'q': return 0;
            case 'w': return 1;
            case 'e': return 2;
            case 'r': return 3;
            case 't': return 4;
            case 'y': return 5;
            case 'u': return 6;
            case 'i': return 7;
            case 'o': return 8;
            case 'p': return 9;
            case 'è': return 10;
            case '+': return 11;

            case 'a': return 12;
            case 's': return 13;
            case 'd': return 14;
            case 'f': return 15
            case 'g': return 16;
            case 'h': return 17;
            case 'j': return 18;
            case 'k': return 19;
            case 'l': return 20;
            case 'ò': return 21;
            case 'à': return 22;
            case 'ù': return 23;

            default: return 0;
        }
    }

    function getNotes() {
        var notes = new Array();
        notes.push(66);
        notes.push(70);
        notes.push(74);
        notes.push(78);
        notes.push(83);
        notes.push(88);
        notes.push(93);
        notes.push(98);
        notes.push(104);
        notes.push(110);
        notes.push(117);
        notes.push(124);

        notes.push(131);
        notes.push(139);
        notes.push(147);
        notes.push(156);
        notes.push(165);
        notes.push(175);
        notes.push(185);
        notes.push(196);
        notes.push(208);
        notes.push(220);
        notes.push(233);
        notes.push(247);

        return notes;
    }
}