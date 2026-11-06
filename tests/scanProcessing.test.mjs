import test from 'node:test';
import assert from 'node:assert/strict';
import {processUploadedInvoice,recoveredScanPhase} from '../lib/scanProcessing.ts';
import {validateInvoiceDetails} from '../lib/invoiceDetails.ts';
test('a lost extraction response recovers a committed scan without invoking extraction again',async()=>{
 let calls=0;const result=await processUploadedInvoice(async()=>{calls++;throw new Error('Network timeout');},async()=>({id:'scan',status:'scanned'}));assert.equal(result.status,'scanned');assert.equal(calls,1);
});
test('a duplicate or plan failure is preserved when no completed invoice can be recovered',async()=>{
 const duplicate=Object.assign(new Error('Duplicate'),{canOverride:false});
 await assert.rejects(()=>processUploadedInvoice(async()=>{throw duplicate;},async()=>null),e=>e===duplicate);
 await assert.rejects(()=>processUploadedInvoice(async()=>{throw duplicate;},async()=>{throw new Error('offline');}),e=>e===duplicate);
});
test('recovered inbox distinguishes ready, active and interrupted scans',()=>{
 assert.equal(recoveredScanPhase('scanned','failed'),'ready');assert.equal(recoveredScanPhase('pending','running'),'processing');
 for(const status of [null,'failed','interrupted','complete'])assert.equal(recoveredScanPhase('pending',status),'retry');
});
const details={vendorName:'Market',invoiceNumber:'42',dateIso:'2026-11-01',subtotal:10,tax:1,total:11};
test('invoice details reject impossible dates, future dates, missing names and invalid amounts',()=>{
 assert.equal(validateInvoiceDetails(details,'2026-11-06'),null);
 assert.equal(validateInvoiceDetails({...details,dateIso:null},'2026-11-06'),null);
 for(const patch of [{dateIso:'2026-02-30'},{dateIso:'2026-11-07'},{dateIso:'11/01/2026'},{vendorName:' '},{tax:NaN},{total:Infinity},{total:100000000}])assert.ok(validateInvoiceDetails({...details,...patch},'2026-11-06'));
});
