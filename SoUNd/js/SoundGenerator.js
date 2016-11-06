function SoundGenerator() {
    var audio = new Audio();
    audio.src = "song2.mp3";
    audio.load();

	var notesArray = getNotes();

    var context = new AudioContext();

    this.fftSize = 16384;
    var analyser = context.createAnalyser();
    analyser.smoothingTimeConstant = 0.7;
    analyser.fftSize = this.fftSize;

    var waveForm = "sawtooth";
    var fact = 6;

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
        if(event.key == 'ArrowDown')
            fact--;
        if(event.key == 'ArrowUp')
            fact++;
        fact = fact > 8 ? 1 : fact;
        fact = fact < 1 ? 8 : fact;        

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
        notes.push(16.35);
        notes.push(17.32);
        notes.push(18.35);
        notes.push(19.45);
        notes.push(20.60);
        notes.push(21.83);
        notes.push(23.12);
        notes.push(24.50);
        notes.push(25.96);
        notes.push(27.50);
        notes.push(29.14);
        notes.push(30.87);

        notes.push(176.35);
        notes.push(177.32);
        notes.push(178.35);
        notes.push(179.45);
        notes.push(180.60);
        notes.push(181.83);
        notes.push(183.12);
        notes.push(184.50);
        notes.push(185.96);
        notes.push(187.50);
        notes.push(189.14);
        notes.push(190.87);

        return notes;
    }
}