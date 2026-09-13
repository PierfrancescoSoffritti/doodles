import test from 'node:test';
import assert from 'node:assert/strict';
import {indexLineTemplate} from '../../js/world/IndexLineTemplate.js?v=stable-30-17';

test('line endpoints retain segment order, full precision and signed zero',()=>{
 const points=[0,0,0,1/3,2,3,1/3,2,3,-0,0,0];
 const indexed=indexLineTemplate(points);
 assert.equal(indexed.positions.length,9);
 for(let i=0;i<points.length;i++)assert.ok(Object.is(indexed.positions[indexed.indices[Math.floor(i/3)]*3+i%3],points[i]));
 assert.equal(indexLineTemplate(points),indexed,'immutable templates should be reused');
 assert.notEqual(indexLineTemplate([...points]),indexed,'separate templates must retain independent ownership');
});
