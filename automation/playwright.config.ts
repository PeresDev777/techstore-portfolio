import { defineConfig, devices } from '@playwright/test'

import { AUTH_STATE_FILE } from './fixtures/paths.ts'
import { ENV } from './utils/env.ts'

/**
 * Quais projetos esta execucao vai rodar.
 *
 * O `webServer` do Playwright e GLOBAL — nao existe "suba o frontend so para este
 * projeto". Sem esta leitura, rodar `tests/api/` construiria e serviria uma aplicacao
 * React que nenhum teste de API abre, somando dezenas de segundos a cada execucao.
 *
 * Ler `--project` do argv e a unica forma de decidir isso em tempo de configuracao.
 * Na duvida (nenhum `--project` informado), sobe o frontend: falhar por excesso de
 * zelo custa tempo; falhar por falta derruba a suite E2E inteira com um erro de
 * conexao que nao explica a causa.
 */
function selectedProjects(): string[] {
  const projects: string[] = []

  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg === '--project' && process.argv[i + 1]) projects.push(process.argv[i + 1]!)
    else if (arg?.startsWith('--project=')) projects.push(arg.slice('--project='.length))
  }

  return projects
}

const SELECTED = selectedProjects()
const NEEDS_FRONTEND = SELECTED.length === 0 || SELECTED.some((p) => p === 'e2e' || p === 'setup')

export default defineConfig({
  testDir: './tests',

  /* Artefatos brutos por teste (screenshot/video/trace de falha) ficam isolados dos reports. */
  outputDir: './test-results',

  /* Nenhum teste pode ficar preso: limites explicitos evitam pipeline pendurada. */
  timeout: 30_000,
  expect: { timeout: 5_000 },

  /*
   * Execucao SERIAL por padrao, e nao por preferencia: e consequencia direta de a
   * aplicacao ter passado a ter backend. Carrinho e pedidos vivem no servidor, entao dois
   * testes em paralelo com o mesmo usuario disputam o mesmo carrinho, e um teste que
   * compra baixa o estoque para todos os outros.
   *
   * O projeto `contract` sobrescreve isso: ele so LE a especificacao, nao toca no estado.
   */
  fullyParallel: false,
  workers: 1,

  /* Retry apenas no CI: mascarar flakiness na maquina do dev esconde problema real. */
  retries: ENV.isCI ? 2 : 0,

  /* Impede que um `test.only` esquecido passe despercebido e reduza a cobertura no CI. */
  forbidOnly: ENV.isCI,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
  ],

  use: {
    baseURL: ENV.baseUrl,

    /* Evidencias: capturadas so quando agregam valor, para nao inflar os artifacts. */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',

    actionTimeout: 10_000,
    navigationTimeout: 15_000,

    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    /*
     * Autentica uma vez pela UI e grava o estado do navegador em disco.
     * So o projeto `e2e` depende dele — ver `fixtures/auth.setup.ts`.
     */
    {
      name: 'setup',
      /* O setup vive em `fixtures/`, fora do `testDir` global — nao e um cenario de teste. */
      testDir: './fixtures',
      testMatch: /auth\.setup\.ts/,
    },

    /*
     * NAVEGADOR. Renomeado de `chromium` para `e2e`: o nome do projeto passou a indicar o
     * TIPO de teste, nao o motor. Quando Firefox e WebKit entrarem, serao `e2e-firefox` e
     * `e2e-webkit` — o eixo que importa na linha de comando e "qual suite", nao "qual browser".
     */
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_FILE,
      },
      dependencies: ['setup'],
    },

    /*
     * API. Sem navegador e sem `storageState`.
     *
     * Herdar o projeto de navegador aqui subiria um Chromium por cenario para nao usa-lo —
     * e o `storageState` do E2E nao serve, porque autenticacao em teste de API e explicita:
     * o teste PRECISA controlar qual token esta apresentando.
     *
     * `baseURL` aponta para a raiz das rotas de negocio, entao os services chamam
     * `/products` em vez de repetir o host em cada arquivo.
     */
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: ENV.apiUrl },

      /*
       * Retry ZERO, inclusive no CI, e esta e a diferenca mais importante entre as duas
       * suites. No E2E o retry compra estabilidade contra a rede. Num teste de
       * concorrencia, um teste que falha e passa na segunda tentativa E EXATAMENTE o
       * defeito que se esta cacando: o retry transformaria a descoberta em verde.
       */
      retries: 0,
    },

    /*
     * CONTRATO. Compara a resposta real com a especificacao publicada em `/docs-json`.
     *
     * **Serial, corrigindo uma suposicao da Sprint 1.** A configuracao original marcava
     * este projeto como `fullyParallel`, com a justificativa de que testes de contrato "so
     * leem". Escreve-los mostrou que nao: validar o schema da resposta de `POST /orders`
     * exige CRIAR um pedido, e validar o carrinho com itens exige adicionar itens. So a
     * metade dos cenarios e de leitura.
     *
     * Manter o paralelismo obrigaria a separar os dois grupos em projetos diferentes para
     * ganhar segundos numa suite que roda em menos de um minuto — complexidade que nao se
     * paga. Fica registrado como evolucao, junto com a do ADR-047.
     */
    {
      name: 'contract',
      testDir: './tests/contract',
      use: { baseURL: ENV.apiUrl },
      retries: 0,
    },
  ],

  /*
   * Sobe o frontend antes da suite — apenas quando algum projeto de navegador vai rodar.
   * Localmente reaproveita um servidor ja em pe; no CI sempre parte do build.
   *
   * A API NAO e gerenciada aqui de proposito: ela precisa de Postgres migrado e semeado
   * antes de subir, e embutir essa cadeia no `webServer` esconderia a falha de banco
   * dentro do log do Playwright. No CI o job a sobe explicitamente.
   */
  webServer: NEEDS_FRONTEND
    ? {
        command: ENV.isCI ? 'npm run preview' : 'npm run build && npm run preview',
        cwd: '../frontend',
        url: ENV.baseUrl,
        reuseExistingServer: !ENV.isCI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      }
    : undefined,
})
