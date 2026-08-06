import { ApiProperty } from '@nestjs/swagger'

/**
 * Formas das respostas de health.
 *
 * Existem porque o `@HealthCheck()` do Terminus documenta o formato CRU do proprio
 * Terminus — `{ status, info, error, details }` — e o que sai pela rede passa antes pelo
 * interceptor de envelope. A anotacao vinha da biblioteca e, por isso, ninguem percebia
 * que estava errada.
 *
 * Mesmo defeito que os decorators de envelope corrigiram no resto da API, aqui vindo de
 * uma dependencia. Vale como lembrete: anotacao de terceiro tambem descreve o que a
 * biblioteca faz, nao o que a SUA aplicacao devolve.
 */

export class LivenessEntity {
  @ApiProperty({ example: 'ok' })
  status: string

  @ApiProperty({ example: 3600, description: 'Segundos desde o início do processo.' })
  uptime: number

  @ApiProperty({ example: '2026-08-06T12:00:00.000Z' })
  timestamp: string
}

class HealthIndicatorStatus {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  status: string
}

export class ReadinessEntity {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status: string

  @ApiProperty({
    example: { database: { status: 'up' } },
    description: 'Dependências saudáveis.',
    additionalProperties: { type: 'object' },
  })
  info: Record<string, HealthIndicatorStatus>

  @ApiProperty({
    example: {},
    description: 'Dependências com falha. Vazio quando tudo está no ar.',
    additionalProperties: { type: 'object' },
  })
  error: Record<string, HealthIndicatorStatus>

  @ApiProperty({
    example: { database: { status: 'up' } },
    description: '`info` e `error` combinados.',
    additionalProperties: { type: 'object' },
  })
  details: Record<string, HealthIndicatorStatus>
}
