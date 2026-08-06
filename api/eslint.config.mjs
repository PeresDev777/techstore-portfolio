import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'coverage', 'eslint.config.mjs'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, prettier],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      /*
       * A regra mais valiosa de um backend. Uma Promise nao aguardada dentro de um handler
       * significa resposta enviada antes do trabalho terminar — e o erro, quando acontece,
       * vira unhandled rejection em vez de virar um 500 tratado pelo exception filter.
       * So existe com informacao de tipo, que e o motivo do `recommendedTypeChecked`.
       */
      '@typescript-eslint/no-floating-promises': 'error',

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
