import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, Length, Matches } from 'class-validator'
import { trim } from '../../../common/transforms/string.transforms'

export class CreateCategoryDto {
  @ApiProperty({ example: 'Câmeras' })
  @IsString({ message: 'Informe o nome da categoria.' })
  @Transform(trim)
  @Length(2, 60, { message: 'Nome deve ter entre 2 e 60 caracteres.' })
  name: string

  /**
   * Opcional: quando ausente, e derivado do nome com `slugify`.
   *
   * Deixar o cliente informar permite corrigir casos que a derivacao automatica erraria
   * (siglas, nomes com numero), sem obrigar quem nao se importa a inventar um.
   */
  @ApiPropertyOptional({ example: 'cameras' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens.',
  })
  slug?: string
}
