import { config as loadDotenv } from 'dotenv'

/**
 * Configuracao de ambiente da suite.
 *
 * Por que dotenv entrou agora. Ate aqui a suite precisava de duas variaveis (`BASE_URL` e
 * `API_URL`) e lia as duas direto de `process.env`, com default no codigo. Com as suites de
 * API e de contrato, o numero cresce — credenciais, URL da instancia de TTL curto, caminho
 * da spec — e passar seis variaveis na linha de comando a cada execucao local e a receita
 * para alguem rodar a suite contra o ambiente errado sem perceber.
 *
 * O `.env` vale SO para desenvolvimento. No CI as variaveis vem do job, que e a fonte
 * auditavel: um arquivo local silenciosamente sobrescrevendo a configuracao do pipeline
 * seria a pior forma possivel de "funciona na minha maquina".
 *
 * `override: false` e o que garante isso — variavel ja presente no ambiente sempre vence.
 */
loadDotenv({ override: false, quiet: true })

/** Le uma variavel obrigatoria, falhando alto e cedo quando ela nao existe. */
function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Variavel de ambiente ausente: ${name}. ` +
        `Copie automation/.env.example para automation/.env ou defina-a no ambiente.`,
    )
  }

  return value
}

/** Le uma variavel opcional com valor padrao. */
function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export const ENV = {
  /** Aplicacao sob teste. Default aponta para o `vite preview` do frontend. */
  baseUrl: optional('BASE_URL', 'http://localhost:4173'),

  /** Raiz das rotas de negocio da API, ja com prefixo e versao. */
  apiUrl: optional('API_URL', 'http://localhost:3000/api/v1'),

  /**
   * Raiz da API SEM versionamento.
   *
   * Health check e a especificacao OpenAPI ficam fora do versionamento de proposito
   * (ADR-027): sao contrato com a infraestrutura, nao com o cliente da API. Derivar por
   * string em vez de pedir mais uma variavel evita que as duas divirjam.
   */
  get apiRoot(): string {
    return this.apiUrl.replace(/\/v\d+\/?$/, '')
  },

  /** Especificacao OpenAPI publicada em runtime — fonte dos testes de contrato. */
  get openApiUrl(): string {
    return `${this.apiRoot}/docs-json`
  },

  isCI: !!process.env.CI,
} as const

export { required }
