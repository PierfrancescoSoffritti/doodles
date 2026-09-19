import { Precipitation } from './weather/Precipitation.js?v=structures-place-4';
export class Snow extends Precipitation {
	constructor(scene, shared) { super(scene, shared, 'snow'); }
	update(time, dt, cameraPos) { this.advance(dt * this.shared.timeFactor, dt, cameraPos); }
}
