import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { trimLower } from '../../../common/transforms/string.transforms'
import { IsEmail, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @ApiProperty({ example: 'qa@techstore.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(trimLower)
  email: string

  /**
   * Sem politica de forca aqui, ao contrario do cadastro.
   *
   * O login precisa aceitar a senha que a conta TEM. Aplicar a regra atual no login
   * recusaria, com erro de validacao, quem cadastrou antes de a regra existir — e ainda
   * revelaria a politica para quem esta tentando adivinhar.
   */
  @ApiProperty({ example: 'Test@1234' })
  @IsString({ message: 'Informe sua senha.' })
  @MinLength(1, { message: 'Informe sua senha.' })
  password: string
}
