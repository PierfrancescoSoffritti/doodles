import { Precipitation } from './weather/Precipitation.js';
export class Rain extends Precipitation {
	constructor(scene, shared) { super(scene, shared, 'rain'); }
	update(dt, cameraPos) { this.advance(dt * this.shared.timeFactor, dt, cameraPos); }
}
