import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInvoicesCsv} from '../lib/csvRows.ts';
const line={desc:'Beans',qty:1.125,unit:'LB',unitPrice:0.1234,ext:12.5,category:'produce',verification:'received',type:'charge'};
const invoice={date:'Nov 7, 2026',dateIso:'2026-11-07',vendorName:'Market',invoiceNumber:'42',lineItems:[line,{...line,desc:'Credit',ext:-2.5,type:'credit'},{...line,desc:'Removed',ext:100,voided:true}]};
test('credits remain numeric and removed lines cannot inflate spreadsheet sums',()=>{
 const csv=buildInvoicesCsv([invoice]);const rows=csv.split('\n').slice(1).map(x=>x.split(','));assert.equal(rows.length,2);assert.equal(rows.reduce((sum,row)=>sum+Number(row[7]),0),10);assert.equal(rows[1][7],'-2.5');assert.equal(rows[1][8],'credit');assert.equal(rows[0][6],'0.1234');assert.ok(rows.every(row=>row[0]==='2026-11-07'));
});
test('untrusted text is escaped without changing numeric credit values',()=>{
 const csv=buildInvoicesCsv([{...invoice,vendorName:'=HYPERLINK("evil")',lineItems:[{...line,desc:'He said "fresh", today\nnew line',ext:-1}]}],{personal:true});assert.match(csv,/^Date,Store,Receipt #,/);assert.ok(csv.includes('\t=HYPERLINK'));assert.ok(csv.includes('"He said ""fresh"", today\nnew line"'));assert.ok(csv.includes(',-1,credit,'));
});
test('an undated receipt exports a local ISO upload date, not display text',()=>{
 const csv=buildInvoicesCsv([{...invoice,dateIso:null,uploadedAt:'2026-11-07T12:00:00',lineItems:[line]}]);assert.equal(csv.split('\n')[1].split(',')[0],'2026-11-07');
});
