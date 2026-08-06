import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { trim, trimLower } from '../../../common/transforms/string.transforms'
import { IsEmail, IsOptional, IsString, Length } from 'class-validator'

/**
 * Atualizacao de perfil.
 *
 * Senha NAO entra aqui — troca de senha tem endpoint proprio, porque exige a senha atual.
 * Se coubesse neste DTO, quem roubasse um access token trocaria a senha da vitima sem
 * conhece-la e assumiria a conta por completo.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Gabriel Peres' })
  @IsOptional()
  @IsString({ message: 'Informe um nome válido.' })
  @Transform(trim)
  @Length(3, 120, { message: 'Nome deve ter entre 3 e 120 caracteres.' })
  name?: string

  @ApiPropertyOptional({ example: 'gabriel@techstore.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(trimLower)
  email?: string
}
