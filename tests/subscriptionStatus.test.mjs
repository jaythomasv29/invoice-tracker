import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionStatusText } from '../lib/subscriptionStatus.ts';
const now = Date.parse('2026-11-03T00:00:00Z');
const e = { isActive: true, willRenew: true, expirationDate: '2026-12-03T00:00:00Z' };
test('canceling renewal retains paid-through access and shows an end date', () => {
 assert.match(subscriptionStatusText({...e, willRenew:false},now), /Auto-renewal off · Pro access until/);
 assert.doesNotMatch(subscriptionStatusText({...e, willRenew:false},now), /Renews/);
});
test('renewal, expiration and billing issues have distinct truthful messages', () => {
 assert.match(subscriptionStatusText(e,now), /^Renews/);
 assert.match(subscriptionStatusText({...e,isActive:false},now), /^Pro ended/);
 assert.match(subscriptionStatusText({...e,billingIssueDetectedAt:'2026-11-02'},now), /^Billing issue/);
 assert.match(subscriptionStatusText({...e,expirationDate:null,willRenew:false},now), /check Apple/);
 assert.match(subscriptionStatusText(null,now), /No active/);
});
