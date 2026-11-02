function validateReleaseConfig(env, { production = false } = {}) {
  const errors = [];
  if (!production) return errors;
  const required = ['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'EXPO_PUBLIC_PRIVACY_POLICY_URL', 'EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_SENTRY_DSN'];
  for (const key of required) if (!env[key]) errors.push(`Missing ${key}`);
  if (!env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_')) errors.push('Production requires a live Clerk publishable key.');
  if (!env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.startsWith('appl_')) errors.push('Production requires an Apple RevenueCat SDK key.');
  for (const key of ['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_PRIVACY_POLICY_URL','EXPO_PUBLIC_TERMS_URL']) {
    try { const url = new URL(env[key]); if (url.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname)) throw new Error(); }
    catch { errors.push(`${key} must use a public HTTPS URL.`); }
  }
  return errors;
}

exports.validateReleaseConfig = validateReleaseConfig;
