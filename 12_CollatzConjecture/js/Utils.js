/**
 * [getPixelRatio Given a canvas 2D context returns a pixel ratio]
 * @param  {[canvas context]} context [convas 2D context]
 * @return {[number]}         [pixelRatio]
 */
function getPixelRatio(context) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const backingStoreRatio = context.webkitBackingStorePixelRatio ||
        context.mozBackingStorePixelRatio ||
        context.msBackingStorePixelRatio ||
        context.oBackingStorePixelRatio ||
        context.backingStorePixelRatio || 
        1;

    return devicePixelRatio / backingStoreRatio;
}

function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

function collatz(number, action) {
	action(number);

	if(number === 1)
		return;

	collatz(number % 2 === 0 ? number/2 : (number*3)+1, action);
}

function BFS(tree, eval) {
	const queue = new Queue(tree);

	while(!queue.isEmpty()) {
		const treeNode = queue.dequeue();
		if(eval(treeNode))
			return treeNode;
		else
			treeNode.children.forEach(child => queue.enqueue(child));
	}
}

function DFS(tree, eval) {
	eval(tree);
	tree.children.forEach(child => DFS(child, eval));
}

function printQueue(queue) {
	let value = queue.dequeue();

	while(value !== null) {
		console.log(value);

		value = queue.dequeue();
	}
}

function Color(hexColor) {
    var self = this;

    this.r, this.g, this.b;

    this.setColorHex = function(colorHex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        colorHex = colorHex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });

        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colorHex);

        if(!result)
            console.log("Error parsing color");
        else {
            this.r = parseInt(result[1], 16);
            this.g = parseInt(result[2], 16);
            this.b = parseInt(result[3], 16);
        }
    }

    this.setColorRgb = function(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    this.getHex = function() {
        return "#" + ((1 << 24) + (this.r << 16) + (this.g << 8) + this.b).toString(16).slice(1);
    }

    this.colorTransition = function(endColor, duration, step, over) {
        function lerp(a, b, u) {
            return (1 - u) * a + u * b;
        }

        var currentColor = new Color();
        var interval = 50;
        var steps = duration / interval;
        var step_u = 1.0 / steps;
        var u = 0.0;

        var theInterval = setInterval(function() {
            if (u >= 1.0) {
                clearInterval(theInterval);

                if(over)
                    over(currentColor);
            }

            currentColor.r = Math.abs(Math.round(lerp(self.r, endColor.r, u)));
            currentColor.g = Math.abs(Math.round(lerp(self.g, endColor.g, u)));
            currentColor.b = Math.abs(Math.round(lerp(self.b, endColor.b, u)));
                
            if(step)
                step(currentColor);
            
            u += step_u;
        }, interval);
    }

    if(hexColor)
        this.setColorHex(hexColor);
    else {
        this.r = -1;
        this.g = -1;
        this.b = -1;
    }
}