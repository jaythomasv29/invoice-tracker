import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmPurchaseActivation } from '../lib/purchaseActivation.ts';
const instant = async () => {};
test('a completed purchase tolerates delayed plan propagation and temporary network errors', async () => {
  let calls=0, reloads=0;
  const result=await confirmPurchaseActivation({expected:'pro',current:()=>true,delay:instant,sync:async()=>{calls++;if(calls===1)throw Error('offline');return calls===2?'free':'pro';},reload:async()=>{reloads++;}});
  assert.equal(result,'active');assert.equal(calls,3);assert.equal(reloads,1);
});
test('a completed charge stays pending when activation cannot be confirmed', async()=>{
  let calls=0;
  assert.equal(await confirmPurchaseActivation({expected:'pro',current:()=>true,delay:instant,sync:async()=>{calls++;throw Error('offline');},reload:instant}),'pending');
  assert.equal(calls,4);
});
test('another workspace cannot receive an old purchase activation result',async()=>{
  let current=true,reloads=0;
  assert.equal(await confirmPurchaseActivation({expected:'pro',current:()=>current,delay:instant,sync:async()=>{current=false;return 'pro';},reload:async()=>{reloads++;}}),'cancelled');
  assert.equal(reloads,0);
});
test('a profile reload error after a purchase is pending verification, never purchase failure',async()=>{
  assert.equal(await confirmPurchaseActivation({expected:'pro',current:()=>true,delay:instant,sync:async()=>'pro',reload:async()=>{throw Error('profile unavailable');}}),'pending');
});
test('an old Plus entitlement does not confirm a newly purchased Pro plan',async()=>{
 assert.equal(await confirmPurchaseActivation({expected:'pro',current:()=>true,delay:instant,sync:async()=>'plus',reload:instant}),'pending');
});
