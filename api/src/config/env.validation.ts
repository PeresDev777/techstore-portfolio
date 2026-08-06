import { plainToInstance } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator'

/**
 * Ambientes suportados. `test` existe para que a suite de automacao possa relaxar
 * limites (rate limit, latencia de log) sem tocar em codigo.
 */
export enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Contrato das variaveis de ambiente.
 *
 * Por que validar env? Porque a alternativa e descobrir que `DATABASE_URL` estava
 * vazia na terceira requisicao de um deploy de sexta-feira. Uma variavel ausente
 * deve derrubar o processo no BOOT, com o nome da variavel na mensagem — falhar
 * alto e cedo e mais barato que falhar baixo e tarde.
 */
class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number

  @IsString()
  @IsNotEmpty()
  API_PREFIX: string

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS: string

  @IsString()
  @IsNotEmpty()
  LOG_LEVEL: string

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string

  /**
   * Minimo 10 por regra, nao por gosto: abaixo disso o bcrypt fica rapido o bastante
   * para tornar um ataque de dicionario offline pratico. O teto de 15 existe porque
   * cada incremento dobra o tempo do login — 16 rounds levam segundos por requisicao.
   */
  @IsInt()
  @Min(10)
  @Max(15)
  BCRYPT_ROUNDS: number

  /**
   * 32 caracteres e o piso, nao a recomendacao. HS256 usa o segredo como chave HMAC:
   * um segredo curto e um alvo pratico para forca bruta offline, e quem o descobre passa
   * a emitir tokens validos para qualquer usuario — incluindo `role: ADMIN`.
   */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string

  /** Em segundos. Minimo de 60 s; teto de 1 h — acima disso a janela sem revogacao
   * deixa de ser aceitavel para um access token. */
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS: number

  @IsInt()
  @Min(1)
  @Max(90)
  REFRESH_TOKEN_TTL_DAYS: number

  @IsInt()
  @Min(1)
  THROTTLE_TTL: number

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  /*
   * Toda variavel de ambiente chega como string — `PORT=3000` e o texto "3000".
   * `enableImplicitConversion` usa os tipos declarados na classe para converter
   * antes de validar, e e por isso que `@IsInt()` funciona aqui.
   */
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: false,
  })

  const errors = validateSync(validated, { skipMissingProperties: false })

  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n')

    throw new Error(`Configuracao de ambiente invalida:\n${details}\n\nVerifique o seu .env`)
  }

  return validated
}
