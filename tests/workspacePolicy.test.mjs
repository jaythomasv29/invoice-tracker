import test from 'node:test';
import assert from 'node:assert/strict';
import { scanCap, recipeCap } from '../shared/workspacePolicy.ts';
import { comparablePrice, compareRetailPurchases } from '../shared/receiptComparison.ts';
import { planFromSubscriber, isWorkspaceId } from '../supabase/functions/_shared/billingState.ts';
const product={store_sku:'MILK123',brand:'Example',package_quantity:1,package_unit:'l',package_count:1,identity_confident:true,discount_complete:true,net_line_total:4};
test('Personal and Business enforce separate free/paid quotas',()=>{assert.equal(scanCap('free','personal'),5);assert.equal(scanCap('pro','personal'),40);assert.equal(scanCap('free','business'),10);assert.equal(scanCap('pro','business'),100);assert.equal(recipeCap('pro','personal'),0);assert.equal(recipeCap('pro','business'),10);});
test('buying twice as much is not a unit-price increase',()=>{const a=comparablePrice(product,1,4,'storeA');const b=comparablePrice({...product,net_line_total:8},2,8,'storeA');assert.equal(compareRetailPurchases(a,b).pct,0);});
test('different stores/SKUs/package sizes and uncertain discounts cannot create comparisons',()=>{const a=comparablePrice(product,1,4,'storeA');assert.equal(compareRetailPurchases(a,comparablePrice(product,1,4,'storeB')),null);assert.equal(compareRetailPurchases(a,comparablePrice({...product,package_quantity:2},1,4,'storeA')),null);assert.equal(comparablePrice({...product,discount_complete:false},1,4,'storeA'),null);assert.equal(comparablePrice({...product,store_sku:null},1,4,'storeA'),null);assert.equal(comparablePrice(product,0,4,'storeA'),null);});
test('readable barcode enables cross-store exact-product matching; weight and volume remain separate',()=>{const a=comparablePrice({...product,barcode:'123456789012',package_quantity:1000,package_unit:'ml'},1,4,'A');const b=comparablePrice({...product,barcode:'123456789012'},1,4,'B');assert.equal(compareRetailPurchases(a,b).pct,0);assert.equal(compareRetailPurchases(a,comparablePrice({...product,barcode:'123456789012',package_unit:'kg'},1,4,'B')),null);});
test('Personal entitlement never unlocks Business and vice versa; cancellation preserves paid-through access',()=>{const now=Date.parse('2026-11-04');const s={entitlements:{personal_pro:{product_identifier:'sift_personal_pro_monthly',expires_date:'2026-12-01'}},subscriptions:{sift_personal_pro_monthly:{store:'app_store',is_sandbox:false,unsubscribe_detected_at:'2026-11-01'}}};assert.equal(planFromSubscriber(s,false,now,'personal'),'pro');assert.equal(planFromSubscriber(s,false,now,'business'),'free');s.entitlements.personal_pro.expires_date='2026-11-01';assert.equal(planFromSubscriber(s,false,now,'personal'),'free');assert.equal(isWorkspaceId('pws_'+'a'.repeat(32)),true);assert.equal(isWorkspaceId('pws_forged'),false);});

test('receipt history charts net normalized prices, excludes mismatched packages and ambiguous coupons',async()=>{
 const {retailHistorySeries}=await import('../shared/receiptHistory.ts');
 const invoice=(id,date)=>({id,invoice_date:date,created_at:date+'T12:00:00Z',vendor_id:'storeA',vendors:{name:'Example store'}});
 const series=retailHistorySeries([
  {qty:2,extended_price:7,retail_product:{...product,net_line_total:6},invoices:invoice('a','2026-11-01')},
  {qty:3,extended_price:12,retail_product:{...product,net_line_total:12},invoices:invoice('b','2026-11-02')},
  {qty:1,extended_price:4,retail_product:{...product,discount_complete:false},invoices:invoice('c','2026-11-03')},
 ]);
 assert.deepEqual(series.map(p=>p.invoiceId),['a','b']);assert.deepEqual(series.map(p=>p.unitPrice),[.3,.4]);assert.equal(series[1].unit,'100ml');
});
