import test from 'node:test';
import assert from 'node:assert/strict';
import {PebbleSteeringScheduler} from '../../js/world/fauna/PebbleSteeringScheduler.js';

function setup(){
 let time=0;
 const scheduler=new PebbleSteeringScheduler({budgetMs:2,now:()=>time});
 const creatures=[0,1,2].map(id=>({id,pos:{x:0,z:0},pebble:{state:'flee',refuge:{x:30,z:0},heading:0,returning:false}}));
 const group={members:creatures};for(const c of creatures)c.group=group;
 return {scheduler,creatures,model:{creatures,listener:{x:-10,z:0},time:1},spend:()=>time++};
}

test('cave searches rotate probes within one shared deadline and publish complete decisions only',()=>{
 const {scheduler,creatures,model,spend}=setup(),probes=[];
 function* search(c){for(let i=0;i<3;i++){spend();probes.push(c.id);yield;}Object.assign(c.pebble,{heading:1,avoiding:true,pathBlocked:false,steeringReach:7});}
 for(const c of creatures)scheduler.request(c,model,1,search);
 scheduler.advance(model);
 assert.deepEqual(probes,[0,1]);assert.deepEqual(creatures.map(c=>c.pebble.heading),[0,0,0]);
 scheduler.advance(model);assert.deepEqual(probes,[0,1,2,0]);
 for(let i=0;i<6;i++)scheduler.advance(model);
 assert.equal(scheduler.jobs.size,0);assert.deepEqual(probes,[0,1,2,0,1,2,0,1,2]);
 for(const c of creatures){assert.equal(c.pebble.heading,1);assert.equal(c.pebble.steeringReach,7);assert.equal(c.pebble.steerAt,1.18);}
});

test('pending decisions use snapshots and cannot overwrite a new escape or removed animal',()=>{
 const {scheduler,creatures,model,spend}=setup();let closed=0;
 function* search(c,context){try{const x=c.pos.x,other=c.group.members[1].pos.x,listener=context.listener.x;for(let i=0;i<6;i++){spend();yield;}assert.equal(c.pos.x,x);assert.equal(c.group.members[1].pos.x,other);assert.equal(context.listener.x,listener);c.pebble.heading=9;}finally{closed++;}}
 const c=creatures[0];scheduler.request(c,model,1,search);scheduler.advance(model);
 c.pos.x=4;creatures[1].pos.x=5;model.listener.x=6;
 for(let i=0;i<5;i++)scheduler.advance(model);assert.equal(c.pebble.heading,9);
 scheduler.request(c,model,1,search);scheduler.advance(model);c.pebble.refuge={x:-30,z:0};scheduler.advance(model);
 assert.equal(scheduler.jobs.size,0);assert.equal(c.pebble.heading,9);
 scheduler.request(c,model,1,search);scheduler.advance(model);model.creatures=[];scheduler.advance(model);
 assert.equal(scheduler.jobs.size,0);assert.equal(closed,3);
});

test('repeated requests retain progress, while a changed intention closes the old search',()=>{
 const {scheduler,creatures,model,spend}=setup();let starts=0,closed=0;
 function* search(){starts++;try{for(;;){spend();yield;}}finally{closed++;}}
 const c=creatures[0];scheduler.request(c,model,1,search);scheduler.advance(model);
 const old=scheduler.jobs.get(c);scheduler.request(c,model,1,search);assert.equal(scheduler.jobs.get(c),old);
 c.pebble.returning=true;scheduler.request(c,model,1,search);scheduler.advance(model);
 assert.equal(starts,2);assert.equal(closed,1);
 c.pebble.state='rest';scheduler.advance(model);assert.equal(closed,2);assert.equal(scheduler.jobs.size,0);
});
