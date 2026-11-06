import test from 'node:test';
import assert from 'node:assert/strict';
import {convertQuantity,normalizePurchase,priceForRecipeQuantity,displayUnitCost} from '../shared/measurement.ts';
import {resolveProductPricing} from '../shared/productCost.ts';
import {ingredientCost,computeIngredientCosts} from '../shared/recipeIngredients.ts';
import {recipeLaborBreakdown,validateRecipeLabor,DEFAULT_RECIPE_LABOR} from '../shared/recipeLabor.ts';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
const row=(patch={})=>({id:'line',raw_description:'Chicken',qty:2,unit_of_measure:'LB',extended_price:10,invoices:{id:'invoice',vendor_id:'vendor',invoice_date:'2026-10-01',created_at:'2026-11-05'},...patch});
const product=(patch={})=>({id:'product',canonical_name:'Chicken',category:null,product_key:'key',source_line_id:'line',manual_price:null,...patch});
const ingredient=(patch={})=>({qty:1,unit:'lb',confirmed:true,aiQty:null,aiUnit:null,aiEstUnitCost:null,...patch});
test('exact same-family conversions separate mass, liquid volume and count',()=>{
 close(convertQuantity(1,'lb','g'),453.59237);close(convertQuantity(1,'US fl oz','mL'),29.5735295625);close(convertQuantity(1,'US cup','US fl oz'),8);
 assert.equal(convertQuantity(1,'oz','fl oz'),null);assert.equal(convertQuantity(1,'L','kg'),null);assert.equal(convertQuantity(1,'each','g'),null);
});
test('printed multipacks and billed catch weights preserve quantity correctly',()=>{
 const multipack=normalizePurchase(row({raw_description:'Almonds 2 x 12 OZ',qty:3,unit_of_measure:'CS',extended_price:36}));close(displayUnitCost(multipack).value,8);
 const catchWeight=normalizePurchase(row({raw_description:'Beef IN TOTAL: 38.5 LBS',qty:2,unit_of_measure:'CS',extended_price:192.5}));close(displayUnitCost(catchWeight).value,5);
 const liters=normalizePurchase(row({qty:2,unit_of_measure:'L',extended_price:8}));close(priceForRecipeQuantity(liters,250,'mL'),1);
});
test('unknown cases and ambiguous EA cartons never become guessed food measurements',()=>{
 assert.equal(normalizePurchase(row({raw_description:'Beef #40',unit_of_measure:'CS'})),null);
 assert.equal(normalizePurchase(row({raw_description:'Egg carton',unit_of_measure:'EA'})),null);
 assert.equal(normalizePurchase(row({raw_description:'2 x 12 oz + 4 x 8 oz',unit_of_measure:'CS'})),null);
 assert.equal(normalizePurchase(row({raw_description:'12/16 OZ',unit_of_measure:'CS'})),null);
 assert.equal(normalizePurchase(row({raw_description:'2 x 12 OZ plus 4 OZ',unit_of_measure:'CS'})),null);
 const manual=normalizePurchase(row({unit_of_measure:'CS',extended_price:24}),{pack_quantity:12,pack_unit:'each',pack_count:2});close(priceForRecipeQuantity(manual,1,'each'),.5);assert.equal(manual.manual,true);
});
test('retail pricing uses attributable net discounts and rejects uncertain allocations',()=>{
 const retail={discount_complete:true,identity_confident:true,package_quantity:1,package_unit:'L',net_line_total:8};
 close(priceForRecipeQuantity(normalizePurchase(row({retail_product:retail})),500,'mL'),2);
 assert.equal(normalizePurchase(row({retail_product:{...retail,discount_complete:false}})),null);
 close(normalizePurchase(row({extended_price:0})).costPerBaseUnit,0);
});
test('recent purchase average is quantity weighted and unit compatible',()=>{
 const observations=[row({qty:1,extended_price:4}),row({qty:3,extended_price:18}),row({qty:1,unit_of_measure:'L',extended_price:500})];
 const resolved=resolveProductPricing(product(),observations,'lb');assert.equal(resolved.sampleSize,2);close(priceForRecipeQuantity(resolved.unitCost,1,'lb'),5.5);
 assert.equal(resolveProductPricing(product(),observations,'each').unitCost,null);
 const manual=resolveProductPricing(product({source_line_id:null,manual_price:6,pack_quantity:500,pack_unit:'g'}),[],'g');close(priceForRecipeQuantity(manual.unitCost,100,'g'),1.2);assert.equal(manual.isManual,true);
 assert.equal(resolveProductPricing(product({source_line_id:null,manual_price:6}),[]).unitCost,null);
});
test('AI estimates remain correct after a compatible unit change and do not cross dimensions',()=>{
 close(ingredientCost(ingredient({qty:1,unit:'kg',aiUnit:'g',aiEstUnitCost:.01})).amount,10);
 assert.equal(ingredientCost(ingredient({qty:1,unit:'kg',aiUnit:null,aiEstUnitCost:.01})).amount,null);
 assert.equal(ingredientCost(ingredient({qty:1,unit:'L',aiUnit:'g',aiEstUnitCost:.01})).amount,null);
 const cost=computeIngredientCosts([ingredient({unitCost:normalizePurchase(row())}),ingredient({unit:'each'})]);close(cost.estimate,5);assert.equal(cost.complete,false);assert.equal(cost.missingCount,1);
});
test('recipe precision is retained until display, including tiny spices',()=>{
 const unit=normalizePurchase(row({qty:1,unit_of_measure:'kg',extended_price:1.23}));const cost=computeIngredientCosts([ingredient({qty:.001,unit:'g',unitCost:unit})]);close(cost.estimate,.00000123);assert.equal(cost.complete,true);
});
test('labor uses active person-minutes, independent of elapsed cooking time',()=>{
 const settings={...DEFAULT_RECIPE_LABOR,servings:4,prepMinutes:15,cookMinutes:90,laborMinutes:30,laborRate:24};
 const cost=recipeLaborBreakdown(8,settings);close(cost.labor,12);close(cost.knownBatch,20);close(cost.perServing,5);
 close(recipeLaborBreakdown(8,{...settings,cookMinutes:200}).labor,12);
 assert.equal(recipeLaborBreakdown(8,{...settings,laborRate:null}).complete,false);assert.equal(recipeLaborBreakdown(8,{...settings,laborMinutes:null}).labor,null);
 close(recipeLaborBreakdown(8,{...settings,laborMinutes:0,laborRate:null}).labor,0);
 assert.equal(recipeLaborBreakdown(8,settings,false).complete,false);
 assert.throws(()=>validateRecipeLabor({...settings,servings:0}));assert.throws(()=>validateRecipeLabor({...settings,laborMinutes:-1}));assert.throws(()=>validateRecipeLabor({...settings,laborRate:NaN}));
});
