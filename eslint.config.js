import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        console: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        TextEncoder: 'readonly',
        Uint8Array: 'readonly',
        Promise: 'readonly',
        BigInt: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        Map: 'readonly',
        Date: 'readonly',
        Array: 'readonly',
        JSON: 'readonly',
        setTimeout: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        location: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
  { ignores: ['dist/**', 'pkg/**', 'node_modules/**'] },
];
