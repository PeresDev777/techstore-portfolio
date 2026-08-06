import { applyDecorators, type Type } from '@nestjs/common'
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger'
import type { ErrorCode } from '../constants/error-codes'
import { ErrorEnvelopeDto, FieldErrorDto, PaginationDto, SuccessEnvelopeDto } from './envelope.dto'

/**
 * Decorators de resposta que descrevem o ENVELOPE, e nao apenas o dado.
 *
 * O problema que eles resolvem: `@ApiResponse({ status: 200, type: OrderEntity })` gera
 * uma especificacao dizendo que a rota devolve um `OrderEntity` — mas o que sai pela rede
 * e `{ success, message, data: OrderEntity }`, porque o `ResponseInterceptor` envolve
 * TODA resposta.
 *
 * A spec ficava, portanto, **errada**. Quem gerasse um cliente tipado a partir de
 * `/api/docs-json` receberia a forma sem o envelope, e o teste de contrato prometido no
 * ADR-031 validaria contra um schema que nao corresponde a realidade — o pior tipo de
 * documentacao, a que parece confiavel.
 *
 * A composicao usa `allOf`: o envelope base mais a propriedade `data` tipada. E a forma
 * do OpenAPI 3 para expressar "isto, e mais aquilo".
 */

/** Referencia ao schema do dado, tratando lista e objeto. */
function dataSchema(model: Type<unknown> | undefined, isArray: boolean): Record<string, unknown> {
  if (!model) {
    // Rotas sem dado (logout, exclusao) devolvem `data: null` — e nao a chave ausente.
    // Um campo que as vezes some obriga todo consumidor a checar existencia.
    return { type: 'null', nullable: true, example: null }
  }

  return isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) }
}

interface SuccessOptions {
  status?: number
  description?: string
}

/** Resposta de sucesso com um recurso: `{ success, message, data: Model }`. */
export function ApiSuccessResponse(
  model?: Type<unknown>,
  options: SuccessOptions = {},
): MethodDecorator {
  const { status = 200, description } = options

  return applyDecorators(
    ApiExtraModels(SuccessEnvelopeDto, ...(model ? [model] : [])),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessEnvelopeDto) },
          { properties: { data: dataSchema(model, false) }, required: ['data'] },
        ],
      },
    }),
  )
}

/** Lista NAO paginada: `{ success, message, data: Model[] }`. */
export function ApiListResponse(
  model: Type<unknown>,
  options: SuccessOptions = {},
): MethodDecorator {
  const { status = 200, description } = options

  return applyDecorators(
    ApiExtraModels(SuccessEnvelopeDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessEnvelopeDto) },
          { properties: { data: dataSchema(model, true) }, required: ['data'] },
        ],
      },
    }),
  )
}

/**
 * Lista paginada: acrescenta `pagination` ao lado de `data`.
 *
 * `pagination` fica na RAIZ do envelope, e nao dentro de `data` — decisao do formato
 * acordado na Sprint 0. Documentar isso corretamente importa: um cliente gerado que
 * procurasse `data.pagination` nao encontraria nada.
 */
export function ApiPaginatedResponse(
  model: Type<unknown>,
  options: SuccessOptions = {},
): MethodDecorator {
  const { status = 200, description } = options

  return applyDecorators(
    ApiExtraModels(SuccessEnvelopeDto, PaginationDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessEnvelopeDto) },
          {
            properties: {
              data: dataSchema(model, true),
              pagination: { $ref: getSchemaPath(PaginationDto) },
            },
            required: ['data', 'pagination'],
          },
        ],
      },
    }),
  )
}

/** Sucesso sem dado a devolver: `data: null`. */
export function ApiNoDataResponse(description: string, status = 200): MethodDecorator {
  return ApiSuccessResponse(undefined, { status, description })
}

/**
 * Resposta de erro com o envelope completo.
 *
 * Antes, os erros eram documentados apenas por `description` — o cliente nao tinha como
 * saber, pela spec, que o corpo traz `code` e `errors[]`. O `code` esperado entra como
 * exemplo, que e a informacao mais acionavel: e por ele que o cliente decide o que fazer.
 */
export function ApiErrorResponse(
  status: number,
  description: string,
  code?: ErrorCode,
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ErrorEnvelopeDto, FieldErrorDto),
    ApiResponse({
      status,
      description,
      schema: code
        ? {
            allOf: [
              { $ref: getSchemaPath(ErrorEnvelopeDto) },
              { properties: { code: { type: 'string', example: code } } },
            ],
          }
        : { $ref: getSchemaPath(ErrorEnvelopeDto) },
    }),
  )
}
