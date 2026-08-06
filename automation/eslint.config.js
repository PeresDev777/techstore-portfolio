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

      /*
       * `ignoreRestSiblings` permite o idioma de OMITIR um campo por desestruturacao:
       *
       *   const { zipCode: _omitido, ...enderecoSemCep } = address
       *
       * As factories usam isso para montar payloads incompletos de proposito — a variavel
       * existe justamente para NAO ser usada. Sem a opcao, a alternativa seria construir o
       * objeto campo a campo, que envelhece a cada campo novo no DTO.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Regras especificas de Playwright so fazem sentido nos specs (ex: proibir waitForTimeout).
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/no-skipped-test': 'warn',

      /*
       * A regra procura `expect(...)` no corpo do teste, mas no Page Object Model as
       * assercoes ficam encapsuladas nos page objects — que e justamente o ponto do
       * padrao. Sem esta lista, todo teste que assevera via page object seria acusado de
       * "nao ter assercao".
       *
       * O matcher do plugin compara o nome do metodo por igualdade exata (nao aceita
       * curinga), entao a lista e enumerada. O custo e ter que incluir um metodo novo
       * aqui; o ganho e que a regra continua pegando o caso que importa de verdade — um
       * teste que executa passos e nao verifica nada.
       */
      'playwright/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            'expect',

            /*
             * Suite de API — o helper unico do ADR-022/031 (`utils/assertions.ts`).
             *
             * Ao contrario da lista do POM abaixo, esta e FECHADA e nao deve crescer: o
             * envelope tem uma forma so, entao um punhado de asseveradores cobre toda a
             * suite. Se alguem precisar de um setimo, a pergunta certa e por que o envelope
             * ganhou um caso especial.
             */
            'expectSuccess',
            'expectPaginated',
            'expectError',
            'expectFieldErrors',
            'expectFasterThan',
            'expectRequestIdEcho',

            // BasePage
            'expectToBeCurrentPage',
            'waitUntilReady',
            // HeaderComponent
            'expectCartCount',
            'expectLoggedInAs',
            // LoginPage
            'expectFormError',
            'expectFieldError',
            'expectNoFieldError',
            'expectSubmitting',
            // DashboardPage
            'expectGreeting',
            // ProductsPage
            'expectResultCount',
            'expectEmptyState',
            // ProductDetailPage
            'expectProductDetails',
            'expectImageLoaded',
            'expectOutOfStock',
            'expectAddButtonDisabled',
            'expectAddButtonHidden',
            'expectIncreaseDisabled',
            // CartPage
            'expectEmpty',
            'expectLineCount',
            'expectTotalsAreConsistent',
            'expectSubtotalMatchesLines',
            // CheckoutPage
            'expectMaskedValue',
            'expectPrefilledFrom',
            'expectSummaryItemCount',
            // OrderSuccessPage
            'expectOrderNumberFormat',
            'expectOrderMatches',
          ],
        },
      ],
    },
  },
)
