function CollatzViz4(stage, state, tree) {

	const shape = new createjs.Shape();
    const graphics = shape.graphics;
    stage.addChild(shape);

	this.draw = function() {

        const stack = new Stack();
        let rad = 0, angle = 0;
        const color = new Color();

        const xOffset = state.width/2;
        const yOffset = state.height/2;

        graphics.clear()
            
        DFS(tree, node => {

            let angleStep = node.value % 2 === 0 ? -1 : -1;
            angleStep *= getRandom(.01, .4)

            const radStep = getRandom(2, 3) * state.pixelRatio;

            const newRad = rad - radStep;
            const newAngle = angle - angleStep;

            const strokeStyle = node.value/500;

            color.setColorRgb(node.value%255, 70, 70);

            graphics
                .beginStroke(color.getHex())
                // .setStrokeDash([20, 40], node.value/400)
                .setStrokeStyle(strokeStyle)
                .moveTo(rad*Math.cos(angle) + xOffset, rad*Math.sin(angle) + yOffset)
                .lineTo(newRad*Math.cos(newAngle) + xOffset, newRad*Math.sin(newAngle) + yOffset)

            rad = newRad;
            angle = newAngle;

            if(node.isLeaf()) {
                const vec = stack.pop();
                if(vec) {
                    rad = vec[0];
                    angle = vec[1];
                }
            } else if(node.children.length > 1) {
                stack.push([rad, angle]);
            }

            
        });

        graphics.endStroke();
    }
}