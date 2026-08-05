import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import playwright from 'eslint-plugin-playwright'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules', 'reports', 'test-results', 'screenshots', 'videos'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    // Regras especificas de Playwright so fazem sentido nos specs (ex: proibir waitForTimeout).
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/no-skipped-test': 'warn',
      'playwright/expect-expect': 'error',
    },
  },
)
