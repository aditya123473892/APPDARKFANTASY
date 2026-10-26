const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/**',
      '.expo/**',
      'darkfantasy-runtime/**',
      'dfbackend/**',
      'Df-Fortend-pm-fe/**',
      'darkfantasy-share/**',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-unresolved': 'off',
      'import/no-named-as-default-member': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
]);
