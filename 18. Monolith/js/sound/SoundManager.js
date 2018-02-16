var objTT
var objTT2

function SoundManager(camera) {

    /*

    // create an AudioListener and add it to the camera
    var listener = new THREE.AudioListener();
    camera.add( listener );

    // create a global audio source
    var shootSound = new THREE.Audio( listener );
    var backgroundLoop = new THREE.Audio( listener );

    var positionalSound = new THREE.PositionalAudio( listener );
    var positionalSound2 = new THREE.PositionalAudio( listener );

    // load a sound and set it as the Audio object's buffer
    var audioLoader = new THREE.AudioLoader();
    
    audioLoader.load('sounds/shoot.wav', function( buffer ) {
        shootSound.setBuffer( buffer );
        shootSound.setLoop( false );
        shootSound.setVolume( 0.04 );
        shootSound.setPlaybackRate( 4 );
    });

    audioLoader.load('sounds/b3.mp3', function( buffer ) {
        backgroundLoop.setBuffer( buffer );
        backgroundLoop.setLoop( true );
        backgroundLoop.setVolume( 0.5 );
        backgroundLoop.setPlaybackRate( 1.1 );
        backgroundLoop.play()
    });

    audioLoader.load('sounds/beam.mp3', function( buffer ) {
        positionalSound.setBuffer( buffer );
        positionalSound.setLoop( true );
        positionalSound.setRefDistance( 6 );
        positionalSound.play();
        positionalSound.setPlaybackRate( 4 );

        objTT.add(positionalSound)

        positionalSound2.setBuffer( buffer );
        positionalSound2.setLoop( true );
        positionalSound2.setRefDistance( 6 );
        positionalSound2.play();
        positionalSound.setPlaybackRate( 2 );

        objTT2.add(positionalSound2)
    });

    eventBus.subscribe(playerShoot, playShootSound)

    function playShootSound() {
        if(!shootSound.isPlaying) {
            shootSound.play()
        }
    }

    */
}