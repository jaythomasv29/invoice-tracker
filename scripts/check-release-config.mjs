import { validateReleaseConfig } from './release-config.mjs';
const production = process.argv.includes('--production') || process.env.APP_ENV === 'production';
const errors = validateReleaseConfig(process.env, { production });
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(production ? 'Production configuration checks passed.' : 'Build configuration checks passed.');
