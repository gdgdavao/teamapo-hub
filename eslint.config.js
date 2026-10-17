import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Every jsx-a11y rule is 'warn', never 'error'. The audit found 195 raw
// buttons and a meaningful amount of genuinely non-compliant markup that is
// being migrated file by file. Promoting the plugin to errors would turn that
// backlog into a build break on day one and block every unrelated change, so
// the rules are advisory: they count, they show up in review, they do not fail
// CI until the migration has actually landed.
const jsxA11yRulesAsWarn = Object.fromEntries(
  Object.entries(jsxA11y.configs.recommended.rules).map(([rule, setting]) => [
    rule,
    Array.isArray(setting) ? ['warn', setting[1]] : 'warn',
  ])
)

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'emulator-data', '.agents', '.impeccable', 'functions', 'scripts', 'docs'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...jsxA11yRulesAsWarn,
      ...reactHooks.configs.recommended.rules,
      // warn, not error: ~44 pre-existing dead locals live in files this refactor
      // does not touch. Cleaned as each file is migrated in later phases.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^[A-Z_]',
          caughtErrors: 'none',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['*.js', '*.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
)