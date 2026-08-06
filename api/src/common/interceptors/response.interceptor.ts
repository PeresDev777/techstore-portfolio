import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { map, type Observable } from 'rxjs'
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator'
import { PaginatedResult, type PaginationMeta } from '../dto/paginated-result'

export interface SuccessEnvelope<T> {
  success: true
  message: string
  data: T
  pagination?: PaginationMeta
}

const DEFAULT_MESSAGE = 'Requisicao processada com sucesso.'

/**
 * Envelopa TODA resposta de sucesso no formato unico da API.
 *
 *   { success: true, message: '...', data: ... }
 *   { success: true, message: '...', data: [...], pagination: { ... } }
 *
 * Decisao central do projeto, e vale entender o trade-off. O custo e um nivel de
 * aninhamento: o cliente escreve `response.data.data`. O ganho e triplo:
 *
 * 1. O cliente tem UMA funcao de desempacotamento, nao uma por endpoint.
 * 2. Sucesso e erro sao distinguiveis pelo corpo, nao so pelo status.
 * 3. A automacao ganha um helper unico (`expectSuccess(res)`) que serve a suite inteira,
 *    em vez de asserções ad-hoc por rota.
 *
 * Por que um interceptor e nao um helper chamado pelos controllers? Porque helper depende
 * de disciplina humana. Um interceptor global e uma garantia estrutural: nao ha como
 * escrever uma rota fora do padrao por esquecimento.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<unknown>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<unknown>> {
    /*
     * getAllAndOverride procura a metadata no HANDLER primeiro e no CONTROLLER depois.
     * Assim da para definir uma mensagem padrao no controller inteiro e sobrescrever
     * apenas nas rotas que merecem texto proprio.
     */
    const message =
      this.reflector.getAllAndOverride<string | undefined>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_MESSAGE

    return next.handle().pipe(
      map((payload) => {
        if (payload instanceof PaginatedResult) {
          return {
            success: true as const,
            message,
            data: payload.data,
            pagination: payload.pagination,
          }
        }

        /*
         * `?? null` em vez de deixar `undefined`: JSON.stringify remove chaves com
         * undefined, e o cliente receberia um envelope SEM o campo `data`. Um contrato
         * onde o campo as vezes some obriga todo consumidor a checar existencia.
         */
        return { success: true as const, message, data: payload ?? null }
      }),
    )
  }
}
