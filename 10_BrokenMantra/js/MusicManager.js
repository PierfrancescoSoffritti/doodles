/**
 * [MusicManager Class responsible for music playback and sond analysis]
 */
function MusicManager() {
    const self = this;

    var isVolumeOn = true;
    var isPlaying = true;

    var audio
    var context, analyser, mediaElementSource;
    // this gives problems on firefox T_T should be fixed with future versions of the browser, since it's working fine with firefox for devs
    initWebAudioApi();

    this.startButtonClicked = function() {
        return context.resume();
    }

    /**
     * [initWebAudioApi Creates a AudioContext and analyser node]
     * @return {[type]} [description]
     */
    function initWebAudioApi() {
        try {
            if(window.AudioContext) {
                if(!context)
                    context = new AudioContext();
            }
            else if(window.webkitAudioContext) {
                if(!context)
                    context = new webkitAudioContext();
            }
            else if(window.mozAudioContext) {
                if(!context)
                    context = new mozAudioContext();
            }
            else
                throw "WebAudio API not supported"

            buildAudioElement();
            
            if(mediaElementSource)
                mediaElementSource.disconnect();
            if(analyser)
                analyser.disconnect();

            analyser = context.createAnalyser();
            analyser.smoothingTimeConstant = 0.7;
            analyser.fftSize = 1024;

            mediaElementSource = context.createMediaElementSource(audio);
            mediaElementSource.connect(analyser);
            analyser.connect(context.destination);

        } catch(e) {
            // already handled in main.js
            console.log(e);

            if(!audio)
                buildAudioElement();
        }
    }

    this.play = function() {
        audio.play();

        isPlaying = true;
    }

    this.pause = function () {
        audio.pause();

        isPlaying = false;
    }

    this.togglePlayback = function() {
        if(isPlaying)
            self.pause();
        else
            self.play();
    }

    function volumeOn() {
        $(audio).animate({volume: 1}, 500);
        
        isVolumeOn = true;
    }

    function volumeOff() {
        $(audio).animate({volume: 0}, 500);

        isVolumeOn = false;
    }

    /**
     * [loadSong Load a song, given its URI]
     * @param  {[string]}   songUri  [URI of the song]
     * @param  {Function} callback [function called when the song is loaded]
     */
    this.loadSong = function(songUri, callback) {
        // if there is no current song, load it immediatly, otherwise fade out the volume and then load
        if(!audio.src)
            load(songUri);
        else {
            var volume = audio.volume;
            $(audio).animate({volume: 0}, 500, function() {audio.volume = volume; load(songUri); } );
        }

        function load(songUri) {
            initWebAudioApi();
            audio.src = songUri;
            audio.load();
            if(callback)
                callback();
        }
    }

    /**
     * [resume Resumes playback, if wasPlaying]
     * @param  {[boolean]} wasPlaying [true if music was playing]
     */
    this.resume = function(wasPlaying) {
        if(wasPlaying)
            play();
    }

    /**
     * [getAverageAmplitude return the current average amplitude of the sound]
     * @return {[number]} [the current average amplitude]
     */
    this.getAverageAmplitude = function() {
        if(!analyser)
            return 0;

        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        return calculateAverageAmplitude(array);

        function calculateAverageAmplitude(array) {
            var values = 0;
            var average;
     
            var length = array.length;
     
            // get all the frequency amplitudes
            var max = 0;
            for (var i = 0; i < length; i++) {
                values += array[i];
                
                if(array[i] > max)
                    max = array[i]
            }
     
            average = values / length;

            // normalize, between 0 and 1
            if(max != 0)
                average /= max;
            else
                return 0;

            return average;
        }
    }

    function buildAudioElement() {
        if(audio) {
            self.pause();           
        }

        audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.autoplay = true;
        
        audio.volume = isVolumeOn ? 1 : 0;

        audio.onended = function(e) {
        }

        // exposed callbacks
        audio.onloadedmetadata = function(event) {
            if(self.onSongLoaded)
                self.onSongLoaded(audio.duration);
        }

        audio.ontimeupdate = function(event) {
            if(self.onTimeUpdated)
                self.onTimeUpdated(audio.currentTime);
        }
    }

    this.onSongLoaded;
    this.onTimeUpdated;

    this.seekTo = function(seconds) {
        audio.currentTime = seconds;
    }
}