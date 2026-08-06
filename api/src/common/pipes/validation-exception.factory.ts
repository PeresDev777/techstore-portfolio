import { UnprocessableEntityException } from '@nestjs/common'
import type { ValidationError } from 'class-validator'
import { ERROR_CODE } from '../constants/error-codes'
import type { FieldError } from '../filters/all-exceptions.filter'

/**
 * Converte os erros do class-validator no formato de erro da API.
 *
 * O comportamento padrao do Nest devolve `message: string[]` — uma lista de frases soltas
 * como `["email must be an email"]`. Isso obriga o cliente a adivinhar a qual campo cada
 * frase pertence, normalmente por substring. Aqui cada erro vira `{ field, message }`.
 *
 * Impacto direto na automacao: o teste assevera QUAL campo falhou
 * (`errors.some((e) => e.field === 'email')`) em vez de casar a frase inteira — asserção
 * que sobrevive a mudanca de copy e a traducao.
 *
 * Status 422 e nao 400: 400 significa "requisicao malformada" (JSON quebrado, header
 * invalido); 422 significa "entendi o corpo, mas o conteudo nao passa nas regras". A
 * distincao permite ao cliente separar bug de integracao de erro de preenchimento.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    message: 'Falha na validacao dos dados enviados.',
    code: ERROR_CODE.VALIDATION_ERROR,
    errors: flattenValidationErrors(errors),
  })
}

/**
 * Mensagem para campo nao declarado no DTO.
 *
 * O `forbidNonWhitelisted` do ValidationPipe produz "property X should not exist" — texto
 * interno da biblioteca, em ingles, que acabaria exibido ao usuario final no meio de uma
 * API em portugues.
 */
const WHITELIST_CONSTRAINT = 'whitelistValidation'
const WHITELIST_MESSAGE = 'Campo não permitido nesta requisição.'

/** Achata erros aninhados em caminho pontilhado: `address.zipCode`, `items.0.quantity`. */
function flattenValidationErrors(errors: ValidationError[], parentPath = ''): FieldError[] {
  const flattened = errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property

    const own = Object.entries(error.constraints ?? {}).map(([constraint, message]) => ({
      field: path,
      message: constraint === WHITELIST_CONSTRAINT ? WHITELIST_MESSAGE : message,
    }))

    const nested = error.children?.length ? flattenValidationErrors(error.children, path) : []

    return [...own, ...nested]
  })

  return dedupe(flattened)
}

/**
 * Remove pares (campo, mensagem) repetidos.
 *
 * Um campo costuma acumular varios validadores, e mais de um pode produzir o MESMO texto:
 * `@IsString({ message: 'Informe sua senha.' })` e `@MinLength(1, { message: 'Informe sua
 * senha.' })` disparam juntos quando o campo vem vazio. Sem deduplicacao, o cliente
 * renderiza a mesma frase duas vezes sob o mesmo input — e um teste que conta erros por
 * campo passa a depender de quantos decorators existem no DTO, nao do comportamento.
 */
function dedupe(errors: FieldError[]): FieldError[] {
  const seen = new Set<string>()

  return errors.filter((error) => {
    const key = `${error.field}|${error.message}`

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}
