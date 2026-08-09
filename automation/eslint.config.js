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
      /*
       * O Playwright EXIGE que o primeiro parametro de uma fixture use desestruturacao,
       * mesmo quando a fixture nao consome nenhuma outra — `async (_args, use)` e recusado
       * em runtime com "First argument must use the object destructuring pattern".
       *
       * A regra padrao proibe `({})`, entao as duas exigencias se contradizem. Esta opcao
       * existe exatamente para esse caso: continua pegando o padrao vazio em desestruturacao
       * de variavel, e libera so o de parametro.
       */
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],

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
            'expectMatchesSpec',
            'expectNoViolations',

            /*
             * Page Objects — apenas os INVARIANTES que sobreviveram a refatoracao da
             * Sprint 5 (ADR-049). Eram 22 nomes; sao 4.
             *
             * A lista encolheu porque a regra mudou: assercao que expressa a expectativa de
             * UM TESTE mora no spec, e o page object expoe o locator. O que fica aqui sao
             * relacoes verdadeiras em qualquer estado da pagina — prontidao, identidade da
             * rota, e as duas identidades contabeis do carrinho.
             */
            'expectToBeCurrentPage',
            'waitUntilReady',
            'expectTotalsAreConsistent',
            'expectSubtotalMatchesLines',
            'expectImageLoaded',
            'expectOrderNumberFormat',
            'expectOrderMatches',
          ],
        },
      ],
    },
  },
)
