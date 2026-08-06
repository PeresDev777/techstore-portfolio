import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { trim, trimLower } from '../../../common/transforms/string.transforms'
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @ApiProperty({ example: 'Gabriel Peres' })
  @IsString({ message: 'Informe seu nome completo.' })
  @Transform(trim)
  @Length(3, 120, { message: 'Nome deve ter entre 3 e 120 caracteres.' })
  name: string

  @ApiProperty({ example: 'novo.cliente@techstore.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(trimLower)
  email: string

  @ApiProperty({
    example: 'Test@1234',
    description: 'Mínimo 8 caracteres, com ao menos uma letra e um número.',
  })
  @IsString({ message: 'Informe uma senha.' })
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  // O bcrypt trunca em 72 bytes sem avisar; recusar e melhor que aceitar uma senha
  // que nao e inteiramente verificada.
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  /*
   * Politica deliberadamente modesta: letra + numero.
   *
   * Exigir simbolo, maiuscula e minuscula empurra o usuario para "Senha@2026" — previsivel
   * — ou para o post-it. Comprimento contribui muito mais para a entropia real do que
   * variedade de classes de caractere, e o NIST recomenda exatamente isso desde 2017.
   */
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'A senha deve conter ao menos uma letra e um número.',
  })
  password: string
}
