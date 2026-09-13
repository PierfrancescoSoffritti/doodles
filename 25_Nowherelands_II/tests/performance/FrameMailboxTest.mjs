import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameMailbox} from '../../js/fx/FrameMailbox.js';
const frame=(id,epoch=0)=>({id,epoch,bitmap:{closed:0,close(){this.closed++;}}});
test('ownership moves to the consumer in sequence',()=>{
 const q=new FrameMailbox(2),a=frame(0),b=frame(1);assert.ok(q.push(a));assert.ok(q.push(b));
 assert.equal(q.take(),a);assert.equal(q.take(),b);assert.equal(q.take(),undefined);
 q.reset(1);assert.equal(a.bitmap.closed,0);assert.equal(b.bitmap.closed,0);
});
test('resize closes queued frames and rejects late asynchronous captures',()=>{
 const q=new FrameMailbox(),a=frame(0),pending=frame(1);q.push(a);q.reset(1);
 assert.equal(a.bitmap.closed,1);assert.equal(q.push(pending),false);assert.equal(pending.bitmap.closed,1);
 const next=frame(2,1);assert.ok(q.push(next));assert.equal(q.take(),next);
});
test('duplicates and overflows cannot replace a scheduled frame',()=>{
 const q=new FrameMailbox(2),a=frame(0),b=frame(1),over=frame(2),duplicate=frame(1);
 q.push(a);q.push(b);assert.equal(q.push(over),false);assert.equal(over.bitmap.closed,1);
 assert.equal(q.take(),a);assert.equal(q.push(duplicate),false);assert.equal(duplicate.bitmap.closed,1);
 assert.equal(q.take(),b);assert.equal(q.length,0);
});
test('repeated suspension does not close a bitmap twice',()=>{
 const q=new FrameMailbox(),a=frame(0);q.push(a);q.reset(1);q.reset(2);
 assert.equal(a.bitmap.closed,1);assert.equal(q.length,0);
});
