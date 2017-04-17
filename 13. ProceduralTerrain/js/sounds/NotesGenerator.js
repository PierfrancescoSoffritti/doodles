function NotesGenerator(fftSize) {

    window.context = window.context || window.webkitcontext;
    var context = new AudioContext();

    var notesArray = getNotes();

    var analyser = context.createAnalyser();
    analyser.smoothingTimeConstant = 0.7;
    analyser.fftSize = fftSize;

    eventBus.subscribe(tuneMonolithClick, playNote);

    let timeout = null;

    function playNote(waveFormIndx, gainValue) {
        const i = getRandomInt(0, notesArray.length-1);
        const fact = getRandomInt(-2, 5);
        
        let waveForm;
        if(!waveFormIndx)
            waveForm = getWaveForm(getRandomInt(1, 4));
        else
            waveForm = getWaveForm(waveFormIndx);

        const oscillator = context.createOscillator();
        oscillator.type = waveForm;
        oscillator.frequency.value = notesArray[i] * Math.pow(2, fact);

        const gainNode = context.createGain();
        if(gainValue !== undefined)
            gainNode.gain.value = gainValue;

        console.log( gainNode.gain.value)

        // generate sound
        oscillator.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(context.destination);

        oscillator.start(0);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 2);

        oscillator.stop(context.currentTime + 2);        
    }

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
            case 1: return "sine";
            case 2: return "square";
            case 3: return "triangle";
            case 4: return "sawtooth";
            default: console.error(key +" is not a valid waveform");
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
}