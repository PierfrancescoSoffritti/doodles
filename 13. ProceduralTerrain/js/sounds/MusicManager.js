const playGrowingTreeSound = "playGrowingTreeSound";

function MusicManager() {

    var audio = buildAudioElement();
    audio.src = "sounds/plantgrow.mp3";
    audio.load();

    eventBus.subscribe(playGrowingTreeSound, function() {
        audio.play();
    });

    function buildAudioElement() {
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.autoplay = true;
        
        audio.onended = function(e) {
        }

        return audio;
    }
}