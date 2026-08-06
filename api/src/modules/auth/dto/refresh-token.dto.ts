import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token recebido no login ou na renovação anterior.' })
  @IsString({ message: 'Informe o refresh token.' })
  @MinLength(1, { message: 'Informe o refresh token.' })
  refreshToken: string
}
