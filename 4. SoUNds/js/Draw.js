function Draw (lineNumber) {
	var self = this;

	var state = {
        pixelRatio: -1,

        strokeStyleCicrle: -1,
        strokeStyleLine: -1,
        color: -1,
        palette: null,

        centerX: -1,
        centerY: -1,

        radius: -1
    }

    var stage = new createjs.Stage("demoCanvas");
	var circle = new createjs.Shape();
	stage.addChild(circle);

	var lines = new Array();
	for(var i=0; i<lineNumber; i++) {
		var line = new createjs.Shape();
		stage.addChild(line);
		lines.push(line);
	}

	this.init = function() {
        state.pixelRatio = getPixelRatio(document.getElementById("demoCanvas").getContext("2d"));

        state.strokeStyleCicrle = 2.5 * state.pixelRatio;
        state.strokeStyleLine = 2 * state.pixelRatio;
        state.color = "#000000";

        state.palette = new Array();
        state.palette.push("#E65100");
        state.palette.push("#EF6C00");
        state.palette.push("#F57C00");
        state.palette.push("#FB8C00");
        state.palette.push("#FF9800");
        state.palette.push("#FFA726");
        state.palette.push("#FFB74D");
        state.palette.push("#FFCC80");

        this.onWindowResize();

        draw();
    }

    // draw circle
	function draw() {
        circle.graphics
            .clear()
            .setStrokeStyle(state.strokeStyleCicrle)
            .beginStroke(state.color)
            .drawCircle(state.centerX, state.centerY, state.radius)
            .endStroke();
    }

    // draw a line using polar coordinates
    function drawLine(line, color, startRad, endRad, angle) {
    	line.graphics
			.clear()
			.setStrokeStyle(state.strokeStyleLine)
			.beginStroke(color)

			.moveTo( state.centerX + ( startRad *Math.cos(angle )), state.centerY + ( startRad *Math.sin( angle)))
			.lineTo( state.centerX + ( endRad *Math.cos(angle )), state.centerY + ( endRad *Math.sin( angle)))

			.endStroke();
    }

    // draw a line for each frequency
    function drawLines(frequencyData) {
        var colorRange = frequencyData.length/state.palette.length;

        for(var i=0; i<frequencyData.length; i++) {

            var color = getColor(i, colorRange);

            drawLine(lines[i], color, state.radius+state.strokeStyleCicrle/2, state.radius+state.strokeStyleCicrle/2+frequencyData[i], getAngle(i));
        }

        function getColor(i, colorRange) {
            var color;

            if(i<colorRange)
                color = state.palette[0];
            else if(i<colorRange*2)
                color = state.palette[1];
            else if(i<colorRange*3)
                color = state.palette[2];
            else if(i<colorRange*4)
                color = state.palette[3];
            else if(i<colorRange*5)
                color = state.palette[4];
            else if(i<colorRange*6)
                color = state.palette[5];
            else if(i<colorRange*7)
                color = state.palette[6];
            else if(i<colorRange*8)
                color = state.palette[7];

            return color;
        }

        function getAngle(i) {
            return (360*i)/frequencyData.length;
        }
    }

    this.update = function (frequencyData) {
    	drawLines(frequencyData);
        draw();  
        stage.update();
    }

    this.onWindowResize = function() {
        var canvas = document.getElementById("demoCanvas");
  
        var width = window.innerWidth;
        var height = window.innerHeight;

        // canvas
        canvas.setAttribute('width', Math.round(width * state.pixelRatio));
        canvas.setAttribute('height', Math.round(height * state.pixelRatio));

        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        // radius
        var maxRadius = Math.min(width, height) * state.pixelRatio;
        state.radius = (maxRadius * 20)/100;

        // center
        state.centerX = (width/2) * state.pixelRatio;
        state.centerY = (height/2) * state.pixelRatio;
    }

	function getPixelRatio(context) {
	    var devicePixelRatio = window.devicePixelRatio || 1;
	    var backingStoreRatio = context.webkitBackingStorePixelRatio ||
	        context.mozBackingStorePixelRatio ||
	        context.msBackingStorePixelRatio ||
	        context.oBackingStorePixelRatio ||
	        context.backingStorePixelRatio || 
	        1;

	    return devicePixelRatio / backingStoreRatio;
	}
}