import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printedCatchWeight, usesPrintedLineTotal, validatedLineTotal } from '../lib/linePricing.ts';
test('catch-weight lines retain the billed amount during description edits',()=>{
 const item={qty:1,unitPrice:13.65,ext:120.53};
 assert.equal(printedCatchWeight('Roasted Duck. IN TOTAL: 8.830 LB'),8.83);
 assert.equal(usesPrintedLineTotal(item),true);
 assert.equal(validatedLineTotal(item.qty,item.unitPrice,item.ext),120.53);
 assert.equal(printedCatchWeight('12/10-15oz Halves'),null);
});
test('ordinary multiplication, adjusted totals and invalid edits remain distinct',()=>{
 assert.equal(usesPrintedLineTotal({qty:2,unitPrice:24,ext:48}),false);
 assert.equal(validatedLineTotal(2,24),48);
 assert.equal(validatedLineTotal(2,24,45),45);
 assert.throws(()=>validatedLineTotal(Infinity,24));
 assert.throws(()=>validatedLineTotal(1,24,NaN));
 assert.throws(()=>validatedLineTotal(0,24));
});
