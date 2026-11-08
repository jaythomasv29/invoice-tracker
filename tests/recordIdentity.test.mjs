import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSavedRecordIds} from '../lib/recordIdentity.ts';
import {scanLimitMessage} from '../lib/entitlements.ts';
test('sample and malformed identifiers cannot pass the shared mutation boundary',()=>{
 for(const id of ['demo-inv-cascade','demo-line-1','','../invoice','user_abc'])assert.throws(()=>assertSavedRecordIds(id),/sample data/);
 assert.doesNotThrow(()=>assertSavedRecordIds('12345678-1234-1234-1234-123456789abc'));
});
test('paid quota messages give the real UTC reset including a year boundary',()=>{
 const m=scanLimitMessage(true,100,new Date('2026-12-31T23:59:59Z'));assert.match(m,/100 scans/);assert.match(m,/Jan 1 at 00:00 UTC/);assert.doesNotMatch(m,/upgrade|free/i);
});
