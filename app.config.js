const { validateReleaseConfig } = require('./scripts/release-config.cjs');
module.exports = ({ config }) => {
  if (process.env.APP_ENV === 'production') {
    const errors = validateReleaseConfig(process.env, { production: true });
    if (errors.length) throw new Error(errors.join('\n'));
  }
  return config;
};
