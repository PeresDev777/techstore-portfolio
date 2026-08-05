import { defineConfig, devices } from '@playwright/test'

import { AUTH_STATE_FILE } from './fixtures/paths.ts'

const IS_CI = !!process.env.CI

/**
 * A baseURL vem do ambiente para que a mesma suite rode contra local, preview ou staging
 * sem alterar codigo. Default aponta para o `vite preview` do frontend.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173'

export default defineConfig({
  testDir: './tests',

  /* Artefatos brutos por teste (screenshot/video/trace de falha) ficam isolados dos reports. */
  outputDir: './test-results',

  /* Nenhum teste pode ficar preso: limites explicitos evitam pipeline pendurada. */
  timeout: 30_000,
  expect: { timeout: 5_000 },

  /* Paralelismo total local; no CI limitamos workers para reduzir flakiness por concorrencia. */
  fullyParallel: true,
  workers: IS_CI ? 2 : undefined,

  /* Retry apenas no CI: mascarar flakiness na maquina do dev esconde problema real. */
  retries: IS_CI ? 2 : 0,

  /* Impede que um `test.only` esquecido passe despercebido e reduza a cobertura no CI. */
  forbidOnly: IS_CI,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
  ],

  use: {
    baseURL: BASE_URL,

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
     * Autentica uma vez e grava o estado do navegador em disco.
     * Os testes dependem deste projeto e partem já logados — ver `fixtures/auth.setup.ts`.
     */
    {
      name: 'setup',
      /* O setup vive em `fixtures/`, fora do `testDir` global — nao e um cenario de teste. */
      testDir: './fixtures',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_FILE,
      },
      dependencies: ['setup'],
    },
    /*
     * Firefox/WebKit e mobile ficam comentados ate a suite estar estavel em chromium.
     * Ativar cedo demais multiplica o custo de manutencao sem ganho de cobertura real.
     */
    // { name: 'firefox', use: { ...devices['Desktop Firefox'], storageState: AUTH_STATE_FILE }, dependencies: ['setup'] },
    // { name: 'mobile-chrome', use: { ...devices['Pixel 7'], storageState: AUTH_STATE_FILE }, dependencies: ['setup'] },
  ],

  /*
   * Sobe o frontend automaticamente antes da suite.
   * Localmente reaproveita um servidor ja rodando; no CI sempre sobe do zero a partir do build.
   */
  webServer: {
    command: IS_CI ? 'npm run preview' : 'npm run build && npm run preview',
    cwd: '../frontend',
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
