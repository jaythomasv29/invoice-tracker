import { planFromSubscriber, isOrgId } from './billingState.ts';
const now = Date.parse('2026-11-01T00:00:00Z');
function fixture(tier = 'pro', patch = {}): any {
  const product = `sift_${tier}_monthly`;
  return { entitlements: { [tier]: { product_identifier: product, expires_date: '2026-12-01T00:00:00Z' } }, subscriptions: { [product]: { store: 'app_store', is_sandbox: false, ...patch } } };
}
function equal(a: unknown,b: unknown) { if(a!==b) throw new Error(`Expected ${b}, got ${a}`); }
Deno.test('active known Apple product grants its exact tier',()=>{ equal(planFromSubscriber(fixture(),false,now),'pro'); equal(planFromSubscriber(fixture('plus'),false,now),'plus'); });
Deno.test('sandbox purchases only grant explicitly allowed test restaurants',()=>{ equal(planFromSubscriber(fixture('pro',{is_sandbox:true}),false,now),'free'); equal(planFromSubscriber(fixture('pro',{is_sandbox:true}),true,now),'pro'); });
Deno.test('unknown product never defaults to paid',()=>{ const s=fixture();s.entitlements.pro.product_identifier='unexpected';equal(planFromSubscriber(s,false,now),'free'); });
Deno.test('expired subscription revokes, grace preserves access',()=>{ const s=fixture();s.entitlements.pro.expires_date='2026-10-01T00:00:00Z';equal(planFromSubscriber(s,false,now),'free');s.subscriptions.sift_pro_monthly.grace_period_expires_date='2026-11-02T00:00:00Z';equal(planFromSubscriber(s,false,now),'pro'); });
Deno.test('non-Apple subscriptions do not overwrite Apple fulfillment',()=>{ equal(planFromSubscriber(fixture('pro',{store:'stripe'}),false,now),'free'); });
Deno.test('anonymous and malformed identities cannot become org plans',()=>{ equal(isOrgId('$RCAnonymousID:abc'),false);equal(isOrgId('org_abc123'),true);equal(isOrgId('org_a/b'),false); });
