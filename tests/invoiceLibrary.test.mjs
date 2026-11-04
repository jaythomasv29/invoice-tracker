import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterInvoiceLibrary} from '../lib/invoiceLibrary.ts';
const rows=[
 {id:'historical',status:'saved',dateIso:'2026-07-15',uploadedAt:new Date(2026,10,3,12).toISOString(),vendorName:'Supplier A',invoiceNumber:'A1'},
 {id:'undated',status:'saved',dateIso:null,uploadedAt:new Date(2026,10,3,12).toISOString(),vendorName:'Supplier B',invoiceNumber:'B1'},
 {id:'review',status:'scanned',dateIso:'2026-11-03',vendorName:'Supplier B',invoiceNumber:'B2'},
];
test('Home drilldown matches saved invoice-date spending and explicit upload-date fallback',()=>{
 assert.deepEqual(filterInvoiceLibrary(rows,'','2026-11-01','2026-11-30').map(x=>x.id),['undated']);
 assert.deepEqual(filterInvoiceLibrary(rows,'','2026-07-01','2026-07-31').map(x=>x.id),['historical']);
});
test('clearing dates restores the whole library and search remains composable',()=>{
 assert.equal(filterInvoiceLibrary(rows,'').length,3);
 assert.deepEqual(filterInvoiceLibrary(rows,'A1').map(x=>x.id),['historical']);
 assert.equal(filterInvoiceLibrary(rows,'Supplier A','2026-11-01','2026-11-30').length,0);
});
