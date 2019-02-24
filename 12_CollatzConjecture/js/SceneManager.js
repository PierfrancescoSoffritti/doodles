function SceneManager(canvas, tree) {
	
	const state = {
        pixelRatio: -1,

        width: -1,
        height: -1
    }

    const stage = new createjs.Stage(canvas);
    state.pixelRatio = getPixelRatio(canvas.getContext('2d'));

    const vizS = [
        new CollatzViz0(stage, state, tree),
        new CollatzViz1(stage, state, tree),
        new CollatzViz2(stage, state, tree),
        new CollatzViz3(stage, state, tree),
        new CollatzViz4(stage, state, tree)
    ]

    const viz = vizS[Math.floor(getRandom(0, vizS.length))];

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