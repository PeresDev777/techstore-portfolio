import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ERROR_CODE } from '../constants/error-codes'
import type { FieldError } from '../filters/all-exceptions.filter'

/**
 * Fabricas das excecoes de dominio.
 *
 * Antes deste refactor havia 30 chamadas espalhadas com esta forma:
 *
 *   throw new NotFoundException({
 *     message: 'Produto não encontrado.',
 *     code: ERROR_CODE.NOT_FOUND,
 *   })
 *
 * Cinco linhas para dizer uma coisa, e — mais relevante — o `code` dependia de alguem
 * lembrar de escreve-lo. Esquecer significava cair no codigo padrao do filtro global: a
 * resposta continuava valida, so que com um codigo generico, e o cliente que decide
 * comportamento por `code` (o frontend faz isso) trataria o caso errado. Um defeito que
 * nao quebra nada visivelmente e por isso sobrevive a revisao.
 *
 * Com as fabricas, `code` e `errors` sao garantidos por construcao e a chamada cabe em
 * uma linha. O tipo de retorno e a excecao concreta do Nest, entao `throw notFound(...)`
 * continua sendo entendido pelo TypeScript como um caminho que nao retorna.
 */

export function notFound(message: string): NotFoundException {
  return new NotFoundException({ message, code: ERROR_CODE.NOT_FOUND, errors: [] })
}

export function conflict(message: string, errors: FieldError[] = []): ConflictException {
  return new ConflictException({ message, code: ERROR_CODE.CONFLICT, errors })
}

export function insufficientStock(message: string, errors: FieldError[] = []): ConflictException {
  return new ConflictException({ message, code: ERROR_CODE.INSUFFICIENT_STOCK, errors })
}

export function forbidden(message: string): ForbiddenException {
  return new ForbiddenException({ message, code: ERROR_CODE.FORBIDDEN, errors: [] })
}

/** Conta desativada — 403, e nao 401: a identidade foi provada, o acesso e que foi negado. */
export function accountDisabled(): ForbiddenException {
  return new ForbiddenException({
    message: 'Esta conta está desativada. Entre em contato com o suporte.',
    code: ERROR_CODE.ACCOUNT_DISABLED,
    errors: [],
  })
}

/**
 * MESMA mensagem para e-mail inexistente e senha errada.
 *
 * Existe como fabrica justamente para que nao haja duas variantes do texto: distinguir os
 * casos entregaria ao atacante um verificador de contas.
 */
export function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    message: 'E-mail ou senha inválidos.',
    code: ERROR_CODE.INVALID_CREDENTIALS,
    errors: [],
  })
}

export function unauthenticated(message = 'Autenticação necessária.'): UnauthorizedException {
  return new UnauthorizedException({ message, code: ERROR_CODE.UNAUTHENTICATED, errors: [] })
}
