import {PebbleSteeringScheduler} from '../../js/world/fauna/PebbleSteeringScheduler.js';
import {FaunaModel as Model} from '../../js/world/fauna/FaunaModel.js';
// Run the same physical-behavior contracts at both production contact rates.
export class FaunaModel extends Model {
 constructor(...args){super(...args);this.pebbleStepHz=Number(process.env.PEBBLE_CONTACT_HZ||120);if(process.env.PEBBLE_STEERING_BUDGET)this.pebbleSteering=new PebbleSteeringScheduler({budgetMs:Number(process.env.PEBBLE_STEERING_BUDGET)});}
}
export {habitatScore} from '../../js/world/fauna/FaunaModel.js';
