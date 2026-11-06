import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialProductName,groupSupplierOptions} from '../lib/productGroups.ts';
import {tickerValue} from '../lib/numberTicker.ts';
import {collectInvoicePages} from '../lib/invoicePages.ts';
const option=(key,name,vendor='a',unit='CS')=>({key,count:2,purchase:{id:key,clean_name:name,raw_description:name,qty:1,unit_of_measure:unit,extended_price:10,invoices:{id:key,vendor_id:vendor,invoice_date:'2026-11-01',created_at:'2026-11-01T12:00:00Z'}}});
test('bean-sprout naming variants group across suppliers while supplier options remain separate',()=>{
 const groups=groupSupplierOptions([option('a','Bean Sprout'),option('b','Bean sprouts','b','LB'),option('c','BEANSPROUTS'),option('a','Bean Sprout')]);
 assert.equal(groups.length,1);assert.equal(groups[0].name,'Bean sprouts');assert.equal(groups[0].variants.length,3);assert.deepEqual(groups[0].variants.map(v=>v.key),['a','b','c']);assert.equal(groups[0].variants[1].purchase.unit_of_measure,'LB');
});
test('grouping preserves preparation, brand, size and meaningful specification differences',()=>{
 const names=['Bean sprouts','Frozen bean sprouts','Soybean sprouts','Brand A milk 2%','Brand A milk 2','Brand B milk 2%','Tomatoes 25 lb','Tomatoes 10 lb'];
 assert.equal(groupSupplierOptions(names.map((n,i)=>option(String(i),n))).length,names.length);
 assert.equal(commercialProductName('  BEAN   SPROUTS '),'bean sprouts');
});
test('ticker rises and falls without overshooting, handles interruption and lands on exact cents',()=>{
 for(const [from,to] of [[100,135.27],[135.27,100],[10,0],[10,-3]]){
  const values=[0,100,300,500,800,1000].map(t=>tickerValue(from,to,t));assert.equal(values[0],from);assert.equal(values.at(-1),to);assert.ok(values.every(v=>v>=Math.min(from,to)&&v<=Math.max(from,to)));
 }
 const halfway=tickerValue(100,200,400);assert.equal(tickerValue(halfway,300,0),halfway);assert.equal(tickerValue(halfway,300,800),300);
 assert.equal(tickerValue(100,NaN,1),0);assert.equal(tickerValue(100,200,10,0),200);
});
test('invoice histories paginate beyond the API cap and preserve data on overlapping pages',async()=>{
 const rows=Array.from({length:1201},(_,n)=>({id:String(n)}));const offsets=[];
 const loaded=await collectInvoicePages(async(offset,limit)=>{offsets.push(offset);return{data:rows.slice(offset,offset+limit),error:null};});assert.equal(loaded.length,1201);assert.deepEqual(offsets,[0,500,1000]);
 const duplicate=await collectInvoicePages(async(offset)=>({data:offset===0?[{id:'a'},{id:'b'}]:offset===2?[{id:'b'},{id:'c'}]:[],error:null}),2);assert.deepEqual(duplicate.map(r=>r.id),['a','b','c']);
 await assert.rejects(()=>collectInvoicePages(async()=>({data:null,error:Error('offline')})),/Could not load invoice history/);
});
