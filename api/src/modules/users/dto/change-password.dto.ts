import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class ChangePasswordDto {
  @ApiProperty({ example: 'Test@1234' })
  @IsString({ message: 'Informe a senha atual.' })
  @MinLength(1, { message: 'Informe a senha atual.' })
  currentPassword: string

  @ApiProperty({ example: 'NovaSenha@2026' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  /*
   * O teto de 72 nao e estetico: o bcrypt trunca silenciosamente a entrada em 72 BYTES.
   * Sem este limite, "senha de 100 caracteres" e "os mesmos 72 primeiros caracteres"
   * autenticam a mesma conta — e o usuario acredita ter uma senha mais forte do que tem.
   * Recusar e melhor que truncar em silencio.
   */
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'A senha deve conter ao menos uma letra e um número.',
  })
  newPassword: string
}
