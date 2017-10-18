function NotesGenerator() {    
    const context = new AudioContext();

    this.playNote = function(freq) {
        const oscillator = context.createOscillator();

        const waveForm = getWaveForm(getRandomInt(1, 2));
        oscillator.type = waveForm;
        
        const fac = 2;

        oscillator.frequency.value = freq;

        const gainNode = context.createGain();
        gainNode.gain.value = .2;
        
        // generate sound
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(0);
        
        const duration = getRandomInt(3, 5);

        gainNode.gain.linearRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.stop(context.currentTime + duration);

        // setInterval(function() {
        //     oscillator.frequency.value = freq*2
        // }, 100);

        // createjs.Tween.get(oscillator.frequency, { loop: true })
        //     .to({ value: freq*2 }, duration/2, createjs.Ease.bounceInOut)
    }

    function getRandomInt(min, max) {
        return Math.round(Math.random() * (max - min) + min);
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