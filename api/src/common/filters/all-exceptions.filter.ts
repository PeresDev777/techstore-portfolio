import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { Request, Response } from 'express'
import { ERROR_CODE, defaultCodeForStatus, type ErrorCode } from '../constants/error-codes'

export interface FieldError {
  field: string
  message: string
}

export interface ErrorEnvelope {
  success: false
  message: string
  code: ErrorCode
  errors: FieldError[]
}

interface NormalizedError {
  status: number
  message: string
  code: ErrorCode
  errors: FieldError[]
}

/**
 * Tratamento global de erros.
 *
 * `@Catch()` sem argumento captura TUDO — HttpException, erro do Prisma, TypeError vindo
 * de um `undefined` inesperado. Essa e a diferenca entre uma API que sempre responde no
 * formato combinado e uma que, no caminho infeliz, devolve o HTML de stack trace padrao
 * do Express e quebra o parser do cliente.
 *
 * Duas regras nao negociaveis aqui:
 *
 * 1. Erro 5xx NUNCA vaza detalhe interno na resposta. Mensagem de banco, caminho de
 *    arquivo e stack trace sao mapa do terreno para quem esta atacando. O detalhe vai
 *    para o LOG, correlacionado por `x-request-id`; o cliente recebe uma mensagem generica.
 * 2. Todo erro sai no mesmo formato. Um cliente que precisa de dois parsers de erro vai
 *    ter dois bugs de parser de erro.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()

    const normalized = this.normalize(exception)

    // 500 literal e nao `HttpStatus.INTERNAL_SERVER_ERROR`: comparar `number` com membro
    // de enum e justamente o que a regra no-unsafe-enum-comparison proibe.
    if (normalized.status >= 500) {
      // Log com o objeto original: o que o cliente nao pode ver, a equipe precisa ver.
      this.logger.error(
        `${request.method} ${request.url} -> ${normalized.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    const body: ErrorEnvelope = {
      success: false,
      message: normalized.message,
      code: normalized.code,
      errors: normalized.errors,
    }

    response.status(normalized.status).json(body)
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()

      // `throw new NotFoundException('Produto nao encontrado.')` -> payload e string.
      if (typeof payload === 'string') {
        return { status, message: payload, code: defaultCodeForStatus(status), errors: [] }
      }

      const record = payload as Record<string, unknown>

      return {
        status,
        message: this.extractMessage(record) ?? this.fallbackMessage(status, exception),
        code: (record.code as ErrorCode | undefined) ?? defaultCodeForStatus(status),
        errors: Array.isArray(record.errors)
          ? (record.errors as FieldError[])
          : this.extractHealthErrors(record),
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.normalizePrismaError(exception)
    }

    /*
     * Violacao de integridade que o Prisma NAO classifica.
     *
     * Nem todo erro do Postgres tem codigo Prisma equivalente. `onDelete: Restrict`
     * dispara o SQLSTATE 23001, que chega como PrismaClientUnknownRequestError e viraria
     * um 500 — quando na verdade e um conflito de estado, culpa do pedido e nao do
     * servidor. A classe 23 do SQLSTATE agrupa violacoes de integridade.
     *
     * Isto e rede de seguranca, nao a defesa principal: os services checam a condicao
     * antes e respondem com mensagem util (ver `CategoriesService.remove`). Aqui garantimos
     * apenas que o status seja honesto quando alguem esquecer.
     */
    if (
      exception instanceof Prisma.PrismaClientUnknownRequestError &&
      /code: "23\d{3}"/.test(exception.message)
    ) {
      return {
        status: 409,
        message: 'A operacao conflita com o estado atual dos dados.',
        code: ERROR_CODE.CONFLICT,
        errors: [],
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor.',
      code: ERROR_CODE.INTERNAL_ERROR,
      errors: [],
    }
  }

  /**
   * Rede de seguranca para erros do Prisma.
   *
   * A regra da arquitetura e que o REPOSITORIO traduz o que ele espera: quem faz
   * `createUser` sabe que P2002 significa "e-mail ja cadastrado" e lanca um
   * ConflictException com essa mensagem, que e melhor do que qualquer texto generico.
   *
   * Este bloco cobre o que ninguem previu. Sem ele, um P2002 esquecido vira 500 com
   * `Unique constraint failed on the fields: (email)` no corpo da resposta — o que
   * confirma a um atacante que aquele e-mail existe na base, alem de expor nome de
   * coluna e estrutura de tabela.
   */
  private normalizePrismaError(error: Prisma.PrismaClientKnownRequestError): NormalizedError {
    switch (error.code) {
      // Violacao de restricao unica.
      case 'P2002':
        return {
          status: 409,
          message: 'Ja existe um registro com este valor.',
          code: ERROR_CODE.CONFLICT,
          errors: this.targetFields(error).map((field) => ({
            field,
            message: 'Valor ja utilizado.',
          })),
        }

      // Violacao de chave estrangeira: apontou para algo que nao existe...
      case 'P2003':
        return {
          status: 409,
          message: 'A operacao viola um vinculo entre registros.',
          code: ERROR_CODE.CONFLICT,
          errors: [],
        }

      // ...ou tentou apagar algo que ainda e referenciado (onDelete: Restrict).
      case 'P2014':
        return {
          status: 409,
          message: 'Este registro nao pode ser removido porque esta em uso.',
          code: ERROR_CODE.CONFLICT,
          errors: [],
        }

      // Registro alvo de update/delete nao encontrado.
      case 'P2025':
        return {
          status: 404,
          message: 'Recurso nao encontrado.',
          code: ERROR_CODE.NOT_FOUND,
          errors: [],
        }

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Erro interno do servidor.',
          code: ERROR_CODE.INTERNAL_ERROR,
          errors: [],
        }
    }
  }

  /** `meta.target` traz as colunas da restricao violada — as vezes string, as vezes array. */
  private targetFields(error: Prisma.PrismaClientKnownRequestError): string[] {
    const target = error.meta?.target

    if (Array.isArray(target)) return target.map(String)
    if (typeof target === 'string') return [target]

    return []
  }

  /**
   * O Nest as vezes entrega `message` como array de strings (ValidationPipe padrao) e as
   * vezes como string. Normalizar aqui evita que o cliente receba um array em um campo
   * documentado como texto.
   */
  private extractMessage(payload: Record<string, unknown>): string | undefined {
    const { message } = payload

    if (typeof message === 'string') return message
    if (Array.isArray(message) && message.length > 0) return String(message[0])

    return undefined
  }

  /**
   * Mensagem quando a excecao nao trouxe uma.
   *
   * Sem isto, o cliente recebe o texto padrao do Nest — "Service Unavailable Exception",
   * "Forbidden resource" — em ingles, no meio de uma API cujas demais mensagens estao em
   * portugues. Mensagem e o que chega ao usuario final; idioma misturado na mesma tela e
   * defeito visivel, nao detalhe de backend.
   *
   * `exception.message` ainda e preferido quando o proprio Nest formatou algo util (o
   * "Cannot GET /api/v1/produtos" de rota inexistente diz exatamente o que faltou).
   */
  private fallbackMessage(status: number, exception: HttpException): string {
    const known: Record<number, string> = {
      401: 'Autenticacao necessaria.',
      403: 'Voce nao tem permissao para executar esta acao.',
      404: 'Recurso nao encontrado.',
      409: 'A operacao conflita com o estado atual do recurso.',
      429: 'Muitas requisicoes. Tente novamente em instantes.',
      503: 'Servico temporariamente indisponivel.',
    }

    // O texto generico do Nest tem o formato "Service Unavailable Exception": se a
    // mensagem for so o nome da classe, nao ha informacao nela que valha preservar.
    const isGenericNestMessage =
      exception.message === exception.constructor.name.replace(/([a-z])([A-Z])/g, '$1 $2')

    return (
      known[status] ??
      (isGenericNestMessage ? 'Nao foi possivel processar a requisicao.' : exception.message)
    )
  }

  /**
   * O Terminus reporta falha de health check com o formato
   * `{ status, info, error: { database: { status, message } }, details }`.
   *
   * Traduzir isso para `errors[]` e a unica excecao consciente a regra de nao expor
   * detalhe interno: o health check descreve as NOSSAS dependencias, nunca dado de
   * usuario, e saber que caiu o `database` — e nao a fila — e justamente o que torna o
   * endpoint util para operacao e para o teste de infraestrutura da suite de automacao.
   */
  private extractHealthErrors(payload: Record<string, unknown>): FieldError[] {
    const healthErrors = payload.error

    if (!healthErrors || typeof healthErrors !== 'object') return []

    return Object.entries(healthErrors as Record<string, { message?: string }>).map(
      ([indicator, detail]) => ({
        field: indicator,
        message: detail?.message ?? 'Indisponivel.',
      }),
    )
  }
}
