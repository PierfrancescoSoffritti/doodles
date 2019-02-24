function SoundGenerator(fftSize) {
    // var audio = new Audio();
    // audio.src = "song2.mp3";
    // audio.load();

    window.context = window.context || window.webkitcontext;
    var context = new AudioContext();

    var notesArray = getNotes();

    var analyser = context.createAnalyser();
    analyser.smoothingTimeConstant = 0.7;
    analyser.fftSize = fftSize;

    var waveForm = "triangle";
    var fact = 0;

    this.startButtonClicked = function() {
        return context.resume();
    }

    $("body").keypress(event => {
        // drums
        if(event.key == "z") {
            kick();
            return;
        }
        if(event.key == "x") {
            snare();
            return;
        }
        if(event.key == "c") {
            hihat();
            return;
        }

        var i = getKeyIndex(event.key);

        var oscillator = context.createOscillator();
        oscillator.type = waveForm;
        oscillator.frequency.value = notesArray[i] * Math.pow(2,fact);

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

        oscillator.stop(context.currentTime + 1);
    })

    $("body").keyup(event => { 
        // change octave
        if(event.key == 'ArrowDown')
            fact--;
        if(event.key == 'ArrowUp')
            fact++;
        fact = fact > 4 ? -2 : fact;
        fact = fact < -2 ? 4 : fact;        

        // change waveform
        waveForm = getWaveForm(event.key);

        console.log("fact: " +fact +" WaveForm: " +waveForm);
    })

    // return the current frequency data
    this.getByteFrequencyData = function() {
        if(!analyser) {
            // return an array of 0s
            var array = [fftSize/2];
            for(var i=0; i<array.length; i++)
                array[i] = 0;
            return array;
        }

        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        return array;
    }

    // maps a key to a waveform
    function getWaveForm(key) {
        switch(key) {
            case '1': return "sine";
            case '2': return "square";
            case '3': return "triangle";
            case '4': return "sawtooth";
            default: return waveForm;
        }
    }

    // maps a key to an integer
    // the integer will be used to access a note in the notes array
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
            case 'f': return 15;
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

    // returns an array of frequency values
    function getNotes() {
        var notes = new Array();

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

        notes.push(262);
        notes.push(277);
        notes.push(294);
        notes.push(311);
        notes.push(330);
        notes.push(349);
        notes.push(370);
        notes.push(392);
        notes.push(415);
        notes.push(440);
        notes.push(466);
        notes.push(494);

        return notes;
    }

    // play kick sound
    function kick() {
        var osc = context.createOscillator();
        var osc2 = context.createOscillator();
        var gainOsc = context.createGain();
        var gainOsc2 = context.createGain();

        osc.type = "triangle";
        osc2.type = "sine";

        gainOsc.gain.setValueAtTime(1, context.currentTime);
        gainOsc.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);

        gainOsc2.gain.setValueAtTime(1, context.currentTime);
        gainOsc2.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
       
        osc.frequency.setValueAtTime(120, context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);

        osc2.frequency.setValueAtTime(50, context.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);

        osc.connect(gainOsc);
        osc2.connect(gainOsc2);

        var finalGain = context.createGain();

        gainOsc.connect(analyser);
        gainOsc2.connect(analyser);

        gainOsc.connect(context.destination);
        gainOsc2.connect(context.destination);

        osc.start(context.currentTime);
        osc2.start(context.currentTime);

        osc.stop(context.currentTime + 0.5);
        osc2.stop(context.currentTime + 0.5);

    }

    // play snare sound
    function snare() {
        var osc3 = context.createOscillator();
        var gainOsc3 = context.createGain();

        var filterGain = context.createGain();

        filterGain.gain.setValueAtTime(1, context.currentTime);
        filterGain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);

        osc3.type = "triangle";
        osc3.frequency.value = 100;
        gainOsc3.gain.value = 0;

        gainOsc3.gain.setValueAtTime(0, context.currentTime);
        gainOsc3.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);

        osc3.connect(gainOsc3);

        osc3.start(context.currentTime);
        osc3.stop(context.currentTime + 0.2);

        var node = context.createBufferSource(),
            buffer = context.createBuffer(1, 4096, context.sampleRate),
            data = buffer.getChannelData(0);

        var filter = context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(100, context.currentTime);
        filter.frequency.linearRampToValueAtTime(1000, context.currentTime + 0.2);


        for (var i = 0; i < 4096; i++) {
            data[i] = Math.random();
        }
        node.buffer = buffer;
        node.loop = true;
        node.connect(filter);
        filter.connect(filterGain);

        var finalGain = context.createGain();

        gainOsc3.connect(finalGain)
        filterGain.connect(finalGain)

        finalGain.connect(analyser);

        gainOsc3.connect(context.destination);
        filterGain.connect(context.destination);

        node.start(context.currentTime);
        node.stop(context.currentTime + 0.2);
        // gainOsc3.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + 0.2);
        // filterGain.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + 0.2);

    }

    // play hihat sound
    function hihat() {
        var gainOsc4 = context.createGain();
        var fundamental = 40;
        var ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];

        var bandpass = context.createBiquadFilter();
        bandpass.type = "bandpass";
        bandpass.frequency.value = 10000;

        var highpass = context.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 7000;

        ratios.forEach(function(ratio) {

            var osc4 = context.createOscillator();
            osc4.type = "square";
            osc4.frequency.value = fundamental * ratio;
            osc4.connect(bandpass);

            osc4.start(context.currentTime);
            osc4.stop(context.currentTime + 0.05);
            
        });

        gainOsc4.gain.setValueAtTime(1, context.currentTime);
        gainOsc4.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.05);
        
        bandpass.connect(highpass);
        highpass.connect(gainOsc4);
        gainOsc4.connect(analyser)
        analyser.connect(context.destination);
    }
}