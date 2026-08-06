import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator'
import { trim } from '../../../common/transforms/string.transforms'

export class CreateProductDto {
  @ApiProperty({ example: 'Fone Aurora Pro' })
  @IsString({ message: 'Informe o nome do produto.' })
  @Transform(trim)
  @Length(3, 140, { message: 'Nome deve ter entre 3 e 140 caracteres.' })
  name: string

  @ApiProperty({ example: 'Aurora' })
  @IsString({ message: 'Informe a marca.' })
  @Transform(trim)
  @Length(2, 80, { message: 'Marca deve ter entre 2 e 80 caracteres.' })
  brand: string

  @ApiProperty()
  @IsString({ message: 'Informe a descrição.' })
  @Transform(trim)
  @Length(10, 2000, { message: 'Descrição deve ter entre 10 e 2000 caracteres.' })
  description: string

  /**
   * Em CENTAVOS e inteiro — a validacao recusa `129.99` explicitamente.
   *
   * Aceitar decimal aqui seria a porta de entrada para o erro que o modelo inteiro existe
   * para impedir: alguem manda reais achando que manda centavos, e o catalogo passa a ter
   * um produto de R$ 1,30 no lugar de R$ 129,99. Falhar na borda e melhor que descobrir
   * na fatura.
   */
  @ApiProperty({ example: 129990, description: 'Preço em centavos (inteiro).' })
  @Type(() => Number)
  @IsInt({ message: 'O preço deve ser um inteiro em centavos.' })
  @Min(0)
  priceInCents: number

  @ApiProperty({ example: 'cat-audio', description: 'Id ou slug da categoria.' })
  @IsString({ message: 'Informe a categoria.' })
  @Transform(trim)
  category: string

  @ApiProperty({ example: '/products/fone-aurora-pro.svg' })
  @IsString({ message: 'Informe a imagem.' })
  @Transform(trim)
  @Length(1, 255, { message: 'Imagem deve ter no máximo 255 caracteres.' })
  imageUrl: string

  @ApiProperty({ example: 24 })
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Estoque não pode ser negativo.' })
  stock: number

  /** Opcional: derivado do nome quando ausente. */
  @ApiPropertyOptional({ example: 'fone-aurora-pro' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens.',
  })
  slug?: string

  @ApiPropertyOptional({ example: 4.8, minimum: 0, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5, { message: 'A nota deve estar entre 0 e 5.' })
  rating?: number

  @ApiPropertyOptional({ example: 1243 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reviewCount?: number
}
