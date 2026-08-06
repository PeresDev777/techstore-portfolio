import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator'
import { onlyDigits } from '../../../common/transforms/digits.transform'
import { trim, trimLower, trimUpper } from '../../../common/transforms/string.transforms'
import { IsCpf } from '../../../common/validators/is-cpf.validator'

/** Unidades federativas. Espelha `BRAZILIAN_STATES` do frontend. */
// prettier-ignore
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export class OrderCustomerDto {
  @ApiProperty({ example: 'Gabriel Peres' })
  @IsString({ message: 'Informe seu nome completo.' })
  @Transform(trim)
  @Length(3, 120, { message: 'Nome deve ter entre 3 e 120 caracteres.' })
  /*
   * Nome E sobrenome — a mesma regra do checkout do frontend.
   *
   * Nao e purismo: o nome vai para o pedido como dado de entrega, e "Gabriel" sozinho nao
   * identifica ninguem num pacote. A verificacao e por contagem de palavras, nao por
   * formato, porque nomes brasileiros nao cabem em regex.
   */
  @Matches(/^\S+(\s+\S+)+$/, { message: 'Informe nome e sobrenome.' })
  fullName: string

  @ApiProperty({ example: 'qa@techstore.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(trimLower)
  email: string

  @ApiProperty({ example: '11144477735', description: 'Com ou sem máscara.' })
  @Transform(onlyDigits)
  @IsCpf({ message: 'CPF inválido.' })
  cpf: string

  @ApiProperty({ example: '11987654321', description: 'DDD + número, com ou sem máscara.' })
  @Transform(onlyDigits)
  @IsString({ message: 'Informe seu telefone.' })
  // 10 digitos = fixo com DDD; 11 = celular com o nono digito.
  @Length(10, 11, { message: 'Telefone incompleto.' })
  phone: string
}

export class OrderAddressDto {
  @ApiProperty({ example: '01310100' })
  @Transform(onlyDigits)
  @IsString({ message: 'Informe o CEP.' })
  @Length(8, 8, { message: 'CEP deve ter 8 dígitos.' })
  zipCode: string

  @ApiProperty({ example: 'Avenida Paulista' })
  @IsString({ message: 'Informe o logradouro.' })
  @Transform(trim)
  @Length(2, 160, { message: 'Logradouro deve ter ao menos 2 caracteres.' })
  street: string

  @ApiProperty({ example: '1000' })
  @IsString({ message: 'Informe o número.' })
  @Transform(trim)
  @Length(1, 20, { message: 'Número deve ter entre 1 e 20 caracteres.' })
  number: string

  @ApiPropertyOptional({ example: 'Sala 42' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(0, 120, { message: 'Complemento deve ter no máximo 120 caracteres.' })
  complement?: string

  @ApiProperty({ example: 'Bela Vista' })
  @IsString({ message: 'Informe o bairro.' })
  @Transform(trim)
  @Length(2, 120, { message: 'Bairro deve ter ao menos 2 caracteres.' })
  district: string

  @ApiProperty({ example: 'São Paulo' })
  @IsString({ message: 'Informe a cidade.' })
  @Transform(trim)
  @Length(2, 120, { message: 'Cidade deve ter ao menos 2 caracteres.' })
  city: string

  @ApiProperty({ example: 'SP', enum: BRAZILIAN_STATES })
  @Transform(trimUpper)
  @IsIn(BRAZILIAN_STATES, { message: 'Selecione um estado válido.' })
  state: string
}

/**
 * O corpo NAO contem itens.
 *
 * Os itens vem do carrinho no servidor, e essa e uma decisao de seguranca antes de ser de
 * conveniencia: se o cliente enviasse a lista, ele enviaria tambem preco e quantidade — e
 * um pedido com `priceInCents: 1` seria aceito. Com o carrinho como origem, preco e
 * estoque sao lidos do banco dentro da transacao, e o cliente nao tem como influenciar.
 */
export class CreateOrderDto {
  @ApiProperty({ type: OrderCustomerDto })
  @ValidateNested()
  // Sem `@Type`, o objeto aninhado chega como literal e o class-validator nao aplica
  // NENHUMA das regras acima — os campos passariam sem validacao, em silencio.
  @Type(() => OrderCustomerDto)
  customer: OrderCustomerDto

  @ApiProperty({ type: OrderAddressDto })
  @ValidateNested()
  @Type(() => OrderAddressDto)
  address: OrderAddressDto
}
