module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: [
    'eslint-config-pretty-strict',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
  },
  plugins: ['react', '@typescript-eslint'],
  settings: {
    react: {
      pragma: 'React',
      version: '17.0.2',
    },
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
  },
  overrides: [
    {
      env: {
        node: true,
      },
      files: ['lambdas/**.js', 'scripts/**.js'],
      rules: {
        'no-unused-vars': 'on',
      },
    },
  ],
};
