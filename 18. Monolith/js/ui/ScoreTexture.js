function ScoreTexture() {
    var canvas = document.createElement('canvas');
    const baseDim = 128;
    const widthRatio = 1;
    const heightRatio = 4;

    canvas.width = baseDim/widthRatio;
    canvas.height = baseDim/heightRatio;

    const ctx = canvas.getContext('2d')
    const txt = 'score: 0';

    drawTextBG(ctx, txt, '20px arial', canvas.width/2 , canvas.height/2);

    this.widthRatio = widthRatio;
    this.heightRatio = heightRatio;
    this.canvas = canvas;

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