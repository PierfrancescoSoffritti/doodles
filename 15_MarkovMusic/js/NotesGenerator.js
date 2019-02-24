function NotesGenerator() {    
    const context = new AudioContext();

    this.playNote = function(freq) {
        const oscillator = context.createOscillator();

        const waveForm = getWaveForm(getRandomInt(1, 1));
        oscillator.type = waveForm;
        
        const fac = 2;

        oscillator.frequency.value = freq;

        const gainNode = context.createGain();
        gainNode.gain.value = .09;
        
        // generate sound
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(0);
        
        const duration = getRandomInt(3, 5);

        gainNode.gain.linearRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.stop(context.currentTime + duration);
    }

    // let oscillator;
    this.playNoteBackground = function(freq) {
        const oscillator = context.createOscillator();

        const waveForm = getWaveForm(getRandomInt(1, 1));
        oscillator.type = waveForm;
        
        const fac = 2;

        oscillator.frequency.value = freq;

        const gainNode = context.createGain();
        gainNode.gain.value = .04;
        
        // generate sound
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(0);
        
        const duration = getRandomInt(2, 10);

        gainNode.gain.linearRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.stop(context.currentTime + duration);

        // setInterval(function() {
        //     oscillator.frequency.value = freq*2
        // }, 400);

        const ease = Math.random() > 0.5 ? createjs.Ease.cubicIn : createjs.Ease.cubicOut;

        const targetFreq = freq > 300 ? freq/4 : freq*3;

        createjs.Tween.get(oscillator.frequency, { loop: false })
            .to({ value: targetFreq }, duration*1000, ease)
    }

    this.update = function(time) {
        // if(oscillator) {
        //     const x = time/100;
        //     const freq = ( (Math.sin(x) )+1) *300;
        //     oscillator.frequency.value = freq;
        //     console.log(freq);
        // }
    }

    

    function getWaveForm(key) {
        switch(key) {
            case 1: return "sine";
            case 2: return "triangle";
            case 3: return "square";
            case 4: return "sawtooth";
            default: console.error(key +" is not a valid waveform");
        }
    }
}