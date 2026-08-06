import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus'
import { SkipThrottle } from '@nestjs/throttler'
import { ERROR_CODE } from '../../common/constants/error-codes'
import { Public } from '../../common/decorators/public.decorator'
import { ApiErrorResponse, ApiSuccessResponse } from '../../common/swagger/api-envelope.decorators'
import { LivenessEntity, ReadinessEntity } from './entities/health.entity'
import { ResponseMessage } from '../../common/decorators/response-message.decorator'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Endpoints operacionais.
 *
 * `VERSION_NEUTRAL` os deixa em `/api/health`, fora do versionamento. Health check e
 * contrato com a INFRAESTRUTURA (Docker, orquestrador, CI), nao com o cliente da API —
 * versionar isso obrigaria a mexer em configuracao de deploy a cada versao nova.
 *
 * `SkipThrottle` porque um monitor que consulta a cada 5 segundos nao pode ser barrado
 * pelo rate limiter e diagnosticado como servico fora do ar.
 */
/*
 * `@Public()` no controller inteiro: com o JwtAuthGuard global, um health check exigindo
 * token seria inutil — o orquestrador e o `webServer` do Playwright nao tem credencial, e
 * receberiam 401 de uma API perfeitamente saudavel.
 */
@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Liveness — o processo esta de pe?
   *
   * Nao toca em dependencia externa de proposito. Se o liveness dependesse do banco, uma
   * indisponibilidade momentanea do Postgres faria o orquestrador MATAR e recriar a API,
   * que e exatamente a reacao errada: o problema nao esta na aplicacao.
   */
  @Get()
  @ApiOperation({ summary: 'Liveness — indica se o processo esta no ar.' })
  @ApiSuccessResponse(LivenessEntity)
  @ResponseMessage('API operacional.')
  liveness(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Readiness — a aplicacao pode ATENDER requisicoes?
   *
   * Aqui sim o banco entra: uma API sem Postgres esta de pe e inutil. E o sinal que o
   * `depends_on` do compose e o `webServer` do Playwright devem esperar. Aguardar "a
   * porta abriu" e a origem classica do primeiro teste vermelho de toda pipeline.
   */
  @Get('ready')
  @ApiSuccessResponse(ReadinessEntity, { description: 'Todas as dependências no ar.' })
  @ApiErrorResponse(503, 'Alguma dependência está fora.', ERROR_CODE.SERVICE_UNAVAILABLE)
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness — verifica as dependencias externas (Postgres).' })
  @ResponseMessage('Dependencias operacionais.')
  readiness() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma, { timeout: 3000 }),
    ])
  }
}
