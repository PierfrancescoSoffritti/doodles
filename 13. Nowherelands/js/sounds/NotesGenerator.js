const playHighNote = "playHighNote";
const playLowNote = "playLowNote";

function NotesGenerator() {

    window.context = window.context || window.webkitcontext;
    var context = new AudioContext();

    var notesArray = getNotes();

    //Choose the importance of each note
    // var nextNoteString = distribution({131:1, 139:0.5, 147:1, 156:0.5, 165:1, 175:1, 185:0.5, 196:1, 208:0.5, 220:1, 233:0.5, 247:1,
    //                              262:1, 277:0.5, 294:1, 311:0.5, 330:1, 349:1, 370:0.5, 392:1, 415:0.5, 440:1, 466:0.5, 496:1})
    
    var nextNoteString = distribution({131:2, 139:0, 147:1, 156:0, 165:2, 175:1, 185:0, 196:2, 208:0, 220:1, 233:0, 247:1,
                                 262:2, 277:0, 294:1, 311:0, 330:2, 349:1, 370:0, 392:2, 415:0, 440:1, 466:0, 496:1})

    var nextFacString = distribution({'-1':2,'0':2, '1':2, '2':1, '3':0 });

    this.startButtonClicked = function() {
        return context.resume();
    }

    this.playRandomNote = function() {
        const i = getRandomInt(0, notesArray.length-1);
        const fact = getRandomInt(-2, 5);
        const waveForm = getWaveForm(getRandomInt(1, 4));
        
        const oscillator = context.createOscillator();
        oscillator.type = waveForm;
        oscillator.frequency.value = notesArray[i] * Math.pow(2, fact);

        const gainNode = context.createGain();
         gainNode.gain.value = .5;

        // generate sound
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(0);

        const duration = getRandomInt(1, 2);
        
        gainNode.gain.linearRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.stop(context.currentTime + duration);
    }

    this.playBackgroundNoteWithDistr = function(waveFormIndx, gainValue, maxFactor){
        const fact = getRandomInt(-2, maxFactor);        
        const waveForm = getWaveForm(waveFormIndx);

        const oscillator = context.createOscillator();
        oscillator.type = waveForm;
        

        let fac = parseInt(nextFacString());
        while(fac > maxFactor)
            fac = parseInt(nextFacString());

        // console.log(fac)

        oscillator.frequency.value = parseInt(nextNoteString()) * Math.pow(2, fac );

        const gainNode = context.createGain();
        gainNode.gain.value = gainValue;
        
        // generate sound
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(0);
        
        const duration = getRandomInt(2, 6);

        gainNode.gain.linearRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.stop(context.currentTime + duration);
    }

    this.playSinNote = function(note) {
        const i = note;

        const fact = getRandomInt(-1, 2);
        
        let waveForm = getWaveForm(1);        

        const oscillator = context.createOscillator();
        oscillator.type = waveForm;
        oscillator.frequency.value = notesArray[i] * Math.pow(2, fact);

        const gainNode = context.createGain();
        gainNode.gain.value = .2;

        // generate sound
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(0);

        const duration = 3//getRandomInt(1, 2);

        gainNode.gain.linearRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.stop(context.currentTime + duration);
    }

    this.playHighNote = function() {
        const i = getRandomInt(0, notesArray.length-1);;

        const fact = getRandomInt(3, 5);
        
        let waveForm = getWaveForm(1);        

        const oscillator = context.createOscillator();
        oscillator.type = waveForm;
        oscillator.frequency.value = parseInt(nextNoteString()) * Math.pow(2, fact);

        const gainNode = context.createGain();
        gainNode.gain.value = .2;

        // generate sound
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(0);

        const duration = 1//getRandomInt(1, 2);

        gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.stop(context.currentTime + duration);
    }

    this.playLowNote = function() {
        const i = getRandomInt(0, notesArray.length-1);;

        const fact = getRandomInt(-2, 0);
        
        let waveForm = getWaveForm(1);        

        const oscillator = context.createOscillator();
        oscillator.type = waveForm;
        oscillator.frequency.value = parseInt(nextNoteString()) * Math.pow(2, fact);

        const gainNode = context.createGain();
        gainNode.gain.value = .2;

        // generate sound
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(0);

        const duration = 4//getRandomInt(1, 2);

        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);
        oscillator.stop(context.currentTime + duration);
    }

    // events
    eventBus.subscribe(tuneMonolithClick, this.playSinNote);
    eventBus.subscribe(playHighNote, this.playHighNote);
    eventBus.subscribe(playLowNote, this.playLowNote);

    // maps a key to a waveform
    function getWaveForm(key) {
        switch(key) {
            case 1: return "sine";
            case 2: return "triangle";
            case 3: return "square";
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

    /**
     * takes an object that maps his keys to probabilities (or counts)
     * and returns a function that returns one of the keys 
     * with that discrete distribution
     */
    function distribution(obj){
        const o = normalizedObj(obj)
        return function(){
            var p = 0
            var r = Math.random()
            for(let key in o){
                p += o[key]
                if(r < p){
                    return key
                }
            }
        }
    }

    function normalizedObj(o){
        var normalized = {}
        var sum = 0
        for(key in o){
            sum += o[key]
        }
        for(key in o){
            normalized[key] = o[key] / sum
        }
        return normalized
    }

}