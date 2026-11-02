import test from 'node:test';
import assert from 'node:assert/strict';
import { averageIngredientCostShare } from '../lib/recipeMetrics.ts';
test('recipe cost shares preserve dishes costing more than their menu price', () => {
  assert.deepEqual(averageIngredientCostShare([{costEstimate:18,menuPrice:10},{costEstimate:2,menuPrice:10}]),{pricedCount:2,average:100});
});
test('missing or invalid prices do not skew the average and zero cost remains valid', () => {
  assert.deepEqual(averageIngredientCostShare([{costEstimate:null,menuPrice:10},{costEstimate:4,menuPrice:0},{costEstimate:Infinity,menuPrice:10},{costEstimate:0,menuPrice:10}]),{pricedCount:1,average:0});
  assert.equal(averageIngredientCostShare([]).average,null);
});
