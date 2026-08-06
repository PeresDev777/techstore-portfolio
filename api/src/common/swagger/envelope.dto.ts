import { ApiProperty } from '@nestjs/swagger'
import { ERROR_CODE } from '../constants/error-codes'

/**
 * Formas do envelope, existentes APENAS para a documentacao.
 *
 * Elas descrevem o que o `ResponseInterceptor` e o `AllExceptionsFilter` produzem em
 * runtime. Nao sao usadas por nenhum controller — se fossem, seriam uma segunda
 * implementacao do envelope, e duas implementacoes divergem.
 *
 * O risco desta abordagem e claro e vale registrar: por serem declarativas, elas podem
 * mentir se alguem mudar o interceptor sem mexer aqui. A mitigacao esta no CI, que baixa
 * `/api/docs-json` a cada execucao — comparar a spec de um PR com a da main mostra
 * qualquer divergencia de contrato.
 */

export class FieldErrorDto {
  @ApiProperty({
    example: 'customer.cpf',
    description: 'Caminho do campo. Aninhados usam ponto: `address.zipCode`.',
  })
  field: string

  @ApiProperty({ example: 'CPF inválido.' })
  message: string
}

export class SuccessEnvelopeDto {
  @ApiProperty({ example: true, description: 'Sempre `true` em respostas 2xx.' })
  success: boolean

  @ApiProperty({
    example: 'Produto recuperado com sucesso.',
    description: 'Texto para humano. NUNCA use como chave de lógica — prefira o status.',
  })
  message: string
}

export class ErrorEnvelopeDto {
  @ApiProperty({ example: false, description: 'Sempre `false` em respostas de erro.' })
  success: boolean

  @ApiProperty({ example: 'Falha na validação dos dados enviados.' })
  message: string

  @ApiProperty({
    enum: Object.values(ERROR_CODE),
    example: ERROR_CODE.VALIDATION_ERROR,
    description:
      'Código estável da falha. É por AQUI que o cliente decide comportamento — `message` ' +
      'muda com revisão de copy e com tradução, o código não.',
  })
  code: string

  @ApiProperty({
    type: [FieldErrorDto],
    description: 'Detalhamento por campo. Vazio quando o erro não é de validação.',
  })
  errors: FieldErrorDto[]
}

/** Metadados de paginacao, presentes apenas em respostas de lista paginada. */
export class PaginationDto {
  @ApiProperty({ example: 1 })
  page: number

  @ApiProperty({ example: 10 })
  limit: number

  @ApiProperty({ example: 12, description: 'Total de registros que satisfazem o filtro.' })
  total: number

  @ApiProperty({ example: 2 })
  totalPages: number
}
