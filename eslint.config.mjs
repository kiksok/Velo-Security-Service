import antfu from '@antfu/eslint-config'

export default antfu({
  toml: false,
  ignores: [
    'native',
    'node_modules',
    'node_modules/*',
    '**/node_modules/**',
    'dist/',
    'dist/*',
    'src/captchapng/**',
    '**/target/**',
    'packages/native',
  ],
  rules: {
    'no-redeclare': 'off',
    'no-console': 'off',
    'no-template-curly-in-string': 'off',
    'ts/no-redeclare': 'off',
    'ts/consistent-type-definitions': 'off',
    'unused-imports/no-unused-imports': 'warn',
    'n/prefer-global/buffer': 'off',
    'node/prefer-global/process': 'off',
    'antfu/no-top-level-await': 'off',
  },
  formatters: {
    css: true,
    html: true,
    markdown: true,
  },
})
