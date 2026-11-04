import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFromSubscriber } from '../supabase/functions/_shared/billingState.ts';
const expiry = Date.parse('2026-12-03T00:00:00Z');
const fixture = (patch = {}) => ({ entitlements: {pro:{product_identifier:'sift_pro_monthly',expires_date:new Date(expiry).toISOString()}},subscriptions:{sift_pro_monthly:{store:'app_store',is_sandbox:false,...patch}} });
test('cancelled auto renewal retains Pro until the exact paid-through expiry', () => {
 const s = fixture({unsubscribe_detected_at:'2026-11-03T00:00:00Z'});
 assert.equal(planFromSubscriber(s,false,expiry-1),'pro');
 assert.equal(planFromSubscriber(s,false,expiry),'free');
});
test('resubscribing keeps access and later renewal extends it', () => {
 const s = fixture({unsubscribe_detected_at:null});
 s.entitlements.pro.expires_date='2027-01-03T00:00:00Z';
 assert.equal(planFromSubscriber(s,false,expiry+1),'pro');
});
test('only the approved sandbox and valid grace period can extend test access', () => {
 const s = fixture({is_sandbox:true,grace_period_expires_date:'2026-12-05T00:00:00Z'});
 assert.equal(planFromSubscriber(s,false,expiry+1),'free');
 assert.equal(planFromSubscriber(s,true,expiry+1),'pro');
 assert.equal(planFromSubscriber(s,true,Date.parse('2026-12-05T00:00:00Z')),'free');
});
