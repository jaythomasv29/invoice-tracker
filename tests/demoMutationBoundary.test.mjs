import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as identity from '../lib/recordIdentity.ts';
// Exercise the real service exports without loading React Native in Node.
// Other services are irrelevant: fake IDs must be rejected before any access.
function load(file){
 const output=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};vm.runInNewContext('(function(require,module,exports){'+output+'\n})')((name)=>name.includes('recordIdentity')?identity:{},mod,mod.exports);return mod.exports;
}
const pipeline=load('../lib/invoicePipeline.ts'),credits=load('../lib/creditRequest.ts');
const real='12345678-1234-1234-1234-123456789abc';
test('sample invoice edits, removal, deletion and details cannot contact the database even outside demo mode',async()=>{
 let calls=0;const db={from(){calls++;throw Error('Database contacted')},rpc(){calls++;throw Error('Database contacted')}};
 for(const invoke of [()=>pipeline.updateLineItem(db,'demo-invoice','demo-line',{desc:'Changed',qty:1,unitPrice:5}),()=>pipeline.setLineItemVoided(db,'demo-invoice','demo-line',true,0,0),()=>pipeline.deleteInvoice(db,'demo-invoice'),()=>pipeline.updateInvoiceDetails(db,'demo-invoice',{}),()=>credits.setCreditStatus(db,[real,'demo-line'],'credited'),()=>credits.setLineMissing(db,'demo-line',true)])await assert.rejects(invoke,/sample data/);
 assert.equal(calls,0);
});
test('a valid persisted record still uses the database service normally',async()=>{
 let calls=0;const db={from(){calls++;return{delete(){return{eq:async()=>({error:null})}}}}};await pipeline.deleteInvoice(db,real);assert.equal(calls,1);
});
