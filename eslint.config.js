const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  { ignores: ['dist/**', 'website/**', 'supabase/**'] },
  expoConfig,
  {
    // React Compiler is disabled in app.json. These compiler eligibility rules
    // misclassify supported Reanimated shared values and classic Animated refs.
    // Keep rules-of-hooks and exhaustive-deps active; re-enable eligibility
    // checks as part of a deliberate React Compiler migration.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
