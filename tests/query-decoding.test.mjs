import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const query = require('query-string');
test('router query parser retains valid unicode and plus behavior', () => {
  const values=query.parse('dish=Cr%C3%A8me+br%C3%BBl%C3%A9e&n=2');
  assert.equal(values.dish,'Crème brûlée'); assert.equal(values.n,'2');
});
test('malformed percent escapes remain recoverable without recursive decoding', () => {
  const malicious='%FF'.repeat(20000);
  assert.doesNotThrow(()=>query.parse('value='+malicious));
  assert.equal(query.parse('value='+malicious).value.length,malicious.length);
  assert.equal(query.parse('value=%ZZ').value,'%ZZ');
});
