import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseConfig } from '../scripts/release-config.mjs';
import fs from 'node:fs';
test('production refuses test authentication and local services', () => {
  const errors = validateReleaseConfig({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example', EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321' }, { production: true });
  assert.ok(errors.some(x => x.includes('live Clerk')));
  assert.ok(errors.some(x => x.includes('public HTTPS')));
});
test('phone and TestFlight profiles bundle a Release build', () => {
  const eas = JSON.parse(fs.readFileSync(new URL('../eas.json',import.meta.url)));
  for (const name of ['preview','production']) {
    assert.equal(eas.build[name].developmentClient,false);
    assert.equal(eas.build[name].ios.buildConfiguration,'Release');
  }
  assert.equal(eas.build.testflight.distribution,'store');
  assert.equal(eas.build.testflight.extends,'production');
  assert.equal(eas.build.testflight.environment,'production');
  assert.equal(eas.build.testflight.env.APP_ENV,'production');
  assert.equal(eas.build.production.env.APP_ENV,'production');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,undefined);
});
