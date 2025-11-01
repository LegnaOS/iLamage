module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2020: true
  },
  extends: [
    'plugin:vue/essential',
    'eslint:recommended'
  ],
  parserOptions: {
    parser: '@babel/eslint-parser',
    requireConfigFile: false,
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  rules: {
    // 关闭所有错误级别的规则，改为警告
    'no-console': 'off',
    'no-debugger': 'off',
    'no-unused-vars': 'warn',
    'no-undef': 'warn',
    'no-redeclare': 'warn',
    'no-empty': 'warn',
    'no-useless-escape': 'warn',
    'no-mixed-spaces-and-tabs': 'warn',
    'no-case-declarations': 'off',
    'vue/multi-word-component-names': 'off'
  },
  globals: {
    '_': 'readonly',
    'window': 'readonly',
    'document': 'readonly',
    'navigator': 'readonly',
    'localStorage': 'readonly'
  }
}

