function SceneManager(canvas, tree) {
	
	const state = {
		// multiply every dimension for this value before drawing, in order to maintain shape's proportions on every screen
        pixelRatio: -1,

        // canvas dimensions
        width: -1,
        height: -1
    }

    const stage = new createjs.Stage(canvas);
    state.pixelRatio = getPixelRatio(canvas.getContext('2d'));

    const shape = new createjs.Shape();
    const graphics = shape.graphics;
    stage.addChild(shape);

    var baseRad = 5 * state.pixelRatio;
    var circleRad = baseRad;
    var time = 0;

    function draw() {

        var stack = new Stack();

        var x = state.width/2, y = state.height;
        var rad = 0, angle = 0;

        var color = new Color();

        graphics
            .clear()
            

        var max = 0;
        DFS(tree, node => {
            if(node.value > max)
                max = node.value;

            var xDelta = node.value % 2 === 0 ? -1 : 1;
            xDelta *= getRandom(.01, .4) //* (Math.sin(rad)+3)/2;

            var yDelta = getRandom(3, 5);

            color.setColorRgb(node.value%255, 70, 70);

            graphics
                .beginStroke(color.getHex())
                // .setStrokeDash([20, 40], node.value/400)
                .setStrokeStyle(node.value/500)
                .moveTo(rad*Math.cos(angle) + state.width/4, rad*Math.sin(angle) + state.height/2)
                .lineTo((rad-yDelta)*Math.cos(angle-xDelta) +state.width/4,
                    (rad-yDelta)*Math.sin(angle-xDelta) + state.height/2)

            rad -= yDelta;
            angle -= xDelta;

            if(node.children.length === 0) {
                const vec = stack.pop();
                if(vec) {
                    rad = vec[0]; angle = vec[1];
                }
            } else if(node.children.length > 1) {
                stack.push([rad, angle]);
            }


        });

        graphics.endStroke();

        console.log("done")
    }

    this.update = function () {
    	time++;

    	// circleRad = baseRad * Math.abs(Math.sin(time*0.01))*10; 

        draw();
        stage.update();  
    }

    this.onWindowResize = function() {
    	// fill screen
        var width = window.innerWidth * state.pixelRatio;
        var height = window.innerHeight * state.pixelRatio;

        // console.log("onWindowResize: " +width +"x" +height);

        // update canvas resolution (it's different from its html/css width and height)
        canvas.setAttribute('width', Math.round(width));
        canvas.setAttribute('height', Math.round(height));

        // save canvas dimensions
        state.width = width;
        state.height = height;
    }

    this.onMouseMove = function(mouseX, mouseY) {
    	// console.log("x: " +mouseX +" y: "+ mouseY);
    }
}