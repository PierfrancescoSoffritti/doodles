// Each bitmap has exactly one owner: the producer, this queue, or the canvas.
export class FrameMailbox {
 constructor(depth = 3) { this.depth=depth;this.epoch=0;this.frames=[];this.lastId=-1; }
 reset(epoch) {
  for(const frame of this.frames)frame.bitmap.close();
  this.frames.length=0;this.lastId=-1;this.epoch=epoch;
 }
 push(frame) {
  if(frame.epoch!==this.epoch||frame.id<=this.lastId||this.frames.length>=this.depth) {
   frame.bitmap.close();return false;
  }
  this.lastId=frame.id;this.frames.push(frame);return true;
 }
 take() { return this.frames.shift(); }
 get length() { return this.frames.length; }
}
