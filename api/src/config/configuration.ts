import { Environment } from './env.validation'

/**
 * Traduz variaveis de ambiente planas em um objeto de configuracao tipado e agrupado
 * por assunto.
 *
 * Por que nao ler `process.env` direto onde precisa? Porque `process.env.THROTTLE_TTL`
 * espalhado pelo codigo e uma dependencia global, string, opcional e sem tipo — tres
 * problemas de uma vez. Aqui a leitura acontece em UM lugar, a conversao acontece uma
 * vez, e o resto da aplicacao recebe `config.get('throttle.ttl')` como number.
 */
export interface AppConfig {
  env: Environment
  isProduction: boolean
  http: {
    port: number
    apiPrefix: string
    corsOrigins: string[]
  }
  log: {
    level: string
    pretty: boolean
  }
  database: {
    url: string
  }
  security: {
    bcryptRounds: number
  }
  auth: {
    accessSecret: string
    accessTtlSeconds: number
    refreshTtlDays: number
  }
  throttle: {
    ttl: number
    limit: number
  }
}

export function configuration(): AppConfig {
  const env = (process.env.NODE_ENV ?? Environment.Development) as Environment
  const isProduction = env === Environment.Production

  return {
    env,
    isProduction,
    http: {
      port: Number(process.env.PORT),
      apiPrefix: String(process.env.API_PREFIX),
      corsOrigins: String(process.env.CORS_ORIGINS)
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
    log: {
      level: String(process.env.LOG_LEVEL),
      // Log legivel por humano em desenvolvimento; JSON puro em producao, onde o
      // consumidor e um agregador (Datadog, CloudWatch) e nao um par de olhos.
      pretty: !isProduction,
    },
    database: {
      url: String(process.env.DATABASE_URL),
    },
    security: {
      bcryptRounds: Number(process.env.BCRYPT_ROUNDS),
    },
    auth: {
      accessSecret: String(process.env.JWT_ACCESS_SECRET),
      accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS),
      refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS),
    },
    throttle: {
      ttl: Number(process.env.THROTTLE_TTL),
      limit: Number(process.env.THROTTLE_LIMIT),
    },
  }
}
