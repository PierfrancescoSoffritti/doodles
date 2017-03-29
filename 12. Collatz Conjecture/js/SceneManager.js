function SceneManager(canvas, tree) {
	
	const state = {
        pixelRatio: -1,

        width: -1,
        height: -1
    }

    const stage = new createjs.Stage(canvas);
    state.pixelRatio = getPixelRatio(canvas.getContext('2d'));

    var viz = new CollatzViz0(stage, state, tree);

    this.update = function () {

        viz.draw();
        stage.update();  
    }

    this.onWindowResize = function() {
        var width = window.innerWidth * state.pixelRatio;
        var height = window.innerHeight * state.pixelRatio;

        canvas.setAttribute('width', Math.round(width));
        canvas.setAttribute('height', Math.round(height));

        state.width = width;
        state.height = height;
    }
}