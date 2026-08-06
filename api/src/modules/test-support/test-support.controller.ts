import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from '../../common/decorators/public.decorator'
import { ResponseMessage } from '../../common/decorators/response-message.decorator'
import { ApiSuccessResponse } from '../../common/swagger/api-envelope.decorators'
import type { SeedSummary } from '../../database/seed.runner'
import { ResetSummaryEntity } from './entities/reset-summary.entity'
import { TestSupportService } from './test-support.service'

/**
 * Apoio a automacao de testes.
 *
 * ESTE CONTROLLER NAO EXISTE EM PRODUCAO. O modulo inteiro so e registrado quando
 * `NODE_ENV !== production` (ver `app.module.ts`) — a rota nao aparece no roteador nem na
 * especificacao OpenAPI.
 *
 * A protecao e ESTRUTURAL e nao um `if` dentro do handler. Um guard que verifica ambiente
 * depende de alguem ter escrito o guard certo e de ninguem o remover; um modulo ausente
 * nao tem como ser chamado. Para um endpoint que apaga o banco inteiro, a diferenca entre
 * "protegido por uma condicao" e "inexistente" e o tamanho do estrago possivel.
 *
 * `@Public()` porque a suite chama isto ANTES de existir qualquer sessao — o reset e o que
 * cria os usuarios com que ela vai logar.
 */
@ApiTags('Apoio a testes (apenas fora de produção)')
@Public()
@SkipThrottle()
@Controller({ path: 'test', version: '1' })
export class TestSupportController {
  constructor(private readonly testSupport: TestSupportService) {}

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apaga todos os dados e reaplica o seed.',
    description:
      'Devolve o banco ao estado de contrato: 6 categorias, 4 usuários e 12 produtos com ' +
      'ids fixos. Indisponível em produção — o módulo não é registrado.',
  })
  @ApiSuccessResponse(ResetSummaryEntity, { description: 'Banco reiniciado.' })
  @ResponseMessage('Banco de dados reiniciado com sucesso.')
  reset(): Promise<SeedSummary> {
    return this.testSupport.reset()
  }
}
