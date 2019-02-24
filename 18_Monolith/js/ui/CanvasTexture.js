function CanvasTexture(constantText = "") {
    var canvas = document.createElement('canvas');
    const baseDim = 128;
    const widthRatio = 1;
    const heightRatio = 4;

    canvas.width = baseDim/widthRatio;
    canvas.height = baseDim/heightRatio;

    const ctx = canvas.getContext('2d')

    this.widthRatio = widthRatio;
    this.heightRatio = heightRatio;
    this.texture = new THREE.Texture(canvas);

    this.setText = function(text) {
        drawTextBG(ctx, constantText +text, '20px arial', canvas.width/2 , canvas.height/2);
        this.texture.needsUpdate = true;
    }

    function drawTextBG(ctx, txt, font, x, y) {        
        ctx.save();
        ctx.font = font;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const textWidth = ctx.measureText(txt).width;
        ctx.fillStyle = '#FFF';
        ctx.fillText(txt, x - textWidth/2, y);
        
        ctx.restore();
    }
}