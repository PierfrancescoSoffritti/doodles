function Draw (lineNumber) {
	var self = this;

	var state = {
        pixelRatio: -1,

        strokeStyleCicrle: -1,
        strokeStyleLine: -1,
        color: -1,

        centerX: -1,
        centerY: -1,

        radius: -1
    }

    var palette = new Array();
    palette.push("#E65100");
    palette.push("#EF6C00");
    palette.push("#F57C00");
    palette.push("#FB8C00");
    palette.push("#FF9800");
    palette.push("#FFA726");
    palette.push("#FFB74D");
    palette.push("#FFCC80");

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

        this.onWindowResize();

        draw();
    }

	function draw() {
        circle.graphics
            .clear()
            .setStrokeStyle(state.strokeStyleCicrle)
            .beginStroke(state.color)
            .drawCircle(state.centerX, state.centerY, state.radius)
            .endStroke();
    }

    function drawLine(line, color, startRad, endRad, angle) {
    	line.graphics
			.clear()
			.setStrokeStyle(state.strokeStyleLine)
			.beginStroke(color)

			.moveTo( state.centerX + ( startRad *Math.cos(angle )), state.centerY + ( startRad *Math.sin( angle)))
			.lineTo( state.centerX + ( endRad *Math.cos(angle )), state.centerY + ( endRad *Math.sin( angle)))

			.endStroke();
    }

    this.update = function (frequencyData) {
    	for(var i=0; i<frequencyData.length; i++) {
    		var color;
    		var unit = frequencyData.length/8;

    		if(i<unit)
    			color = palette[0];
    		else if(i<unit*2)
    			color = palette[1];
    		else if(i<unit*3)
    			color = palette[2];
    		else if(i<unit*4)
    			color = palette[3];
    		else if(i<unit*5)
    			color = palette[4];
    		else if(i<unit*6)
    			color = palette[5];
    		else if(i<unit*7)
    			color = palette[6];
    		else if(i<unit*7)
    			color = palette[7];

    		drawLine(lines[i], color, state.radius+state.strokeStyleCicrle/2, state.radius+state.strokeStyleCicrle/2+frequencyData[i], getAngle(i));
    	}

    	function getAngle(i) {
    		return (360*i)/frequencyData.length;
    	}

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

        console.log("onWindowResize: " +width +"x" +height);
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