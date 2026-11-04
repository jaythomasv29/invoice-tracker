import {test} from 'node:test';
import assert from 'node:assert/strict';
import {kitchenProgress} from '../lib/kitchenProgress.ts';
const now=new Date(2026,10,4,12);
const row=(id,created)=>({id,vendor_id:'v',total:10,invoice_date:'2026-07-15',created_at:new Date(2026,10,created,12).toISOString()});
test('milestones count unique saved records and activity uses upload days, not invoice dates',()=>{
 const p=kitchenProgress([row('a',2),row('b',3),row('b',3),row('c',4),row('d',4)],now);
 assert.equal(p.count,4);assert.equal(p.target,5);assert.equal(p.remaining,1);assert.equal(p.activeDays,3);
 assert.equal(p.days[2].logged,true);assert.equal(p.days[2].isToday,true);
});
test('zero, completed milestones, future activity and large histories remain truthful',()=>{
 assert.equal(kitchenProgress([],now).target,1);
 const p=kitchenProgress([row('a',6)],now);assert.equal(p.activeDays,0);assert.equal(p.target,5);
 const many=Array.from({length:500},(_,i)=>row(String(i),4));assert.equal(kitchenProgress(many,now).target,750);
});
