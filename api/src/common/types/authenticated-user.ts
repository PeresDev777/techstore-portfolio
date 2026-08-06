import type { Role } from '@prisma/client'

/**
 * O que a aplicacao conhece sobre quem fez a requisicao.
 *
 * Repare no que NAO esta aqui: nem hash de senha, nem o token, nem a entidade completa do
 * Prisma. O que a strategy coloca em `req.user` acaba acessivel a qualquer controller e,
 * por descuido, a qualquer resposta — entao o objeto carrega o minimo necessario para
 * autorizar uma acao.
 */
export interface AuthenticatedUser {
  id: string
  email: string
  role: Role
}

/** Claims do access token. `sub` e o padrao do JWT (RFC 7519) para o sujeito. */
export interface AccessTokenPayload {
  sub: string
  email: string
  role: Role
  iat?: number
  exp?: number
}
