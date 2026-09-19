import test from 'node:test';
import assert from 'node:assert/strict';
import {AuxiliaryWorkBudget} from '../../js/fx/AuxiliaryWorkBudget.js';

test('expensive captures leave time for foreground frames before another capture',()=>{
 let time=0,captures=0;const budget=new AuxiliaryWorkBudget({now:()=>time});
 const capture=()=>{captures++;time+=15;};
 assert.equal(budget.run(capture),true);
 time+=33;assert.equal(budget.run(capture),false);
 time+=33;assert.equal(budget.run(capture),false);
 time+=35;assert.equal(budget.run(capture),true);
 assert.equal(captures,2);
});
test('a long idle interval cannot bank an unbounded burst of captures',()=>{
 let time=0;const budget=new AuxiliaryWorkBudget({now:()=>time});time=60000;
 assert.equal(budget.run(()=>{time+=10;}),true);
 assert.equal(budget.run(()=>assert.fail('must yield to foreground work')),false);
});
test('failed captures still account for their elapsed work',()=>{
 let time=0;const budget=new AuxiliaryWorkBudget({now:()=>time});
 assert.throws(()=>budget.run(()=>{time+=20;throw Error('capture');}),/capture/);
 assert.equal(budget.run(()=>assert.fail('must recover allowance first')),false);
});
