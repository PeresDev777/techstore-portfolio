import { ApiProperty } from '@nestjs/swagger'
import { UserEntity } from '../../users/entities/user.entity'

/**
 * Resposta de uma autenticacao bem-sucedida.
 *
 * O refresh token viaja no CORPO da resposta, e nao em cookie httpOnly.
 *
 * Cookie httpOnly seria mais seguro: JavaScript nao o alcanca, entao um XSS nao consegue
 * roubar a sessao. A escolha aqui foi pelo corpo por duas razoes praticas — o ecossistema
 * do projeto e uma SPA em outro dominio (CORS com credenciais), e a suite de testes de API
 * manipula tokens explicitamente, o que fica opaco quando eles vivem em cookie.
 *
 * A mitigacao e o desenho todo: access token de 15 minutos, refresh rotacionado a cada uso
 * e revogacao de familia ao detectar reuso. Migrar para cookie e uma mudanca contida a
 * este arquivo e ao controller.
 */
export class AuthSessionEntity {
  @ApiProperty({ type: UserEntity })
  user: UserEntity

  @ApiProperty({ description: 'JWT de acesso. Enviar em `Authorization: Bearer <token>`.' })
  accessToken: string

  @ApiProperty({ description: 'Token opaco de renovação. Trocado a cada uso.' })
  refreshToken: string

  @ApiProperty({ example: 'Bearer' })
  tokenType: string

  @ApiProperty({ example: 900, description: 'Validade do access token, em segundos.' })
  expiresIn: number
}

/** Resposta da renovacao: novos tokens, sem repetir os dados do usuario. */
export class RefreshedTokensEntity {
  @ApiProperty()
  accessToken: string

  @ApiProperty()
  refreshToken: string

  @ApiProperty({ example: 'Bearer' })
  tokenType: string

  @ApiProperty({ example: 900 })
  expiresIn: number
}
