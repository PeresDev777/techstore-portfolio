import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../types/authenticated-user'

/**
 * Injeta o usuario autenticado como parametro do handler.
 *
 *   findMe(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * Sem isto, o controller precisaria receber `@Req() req` e cavar `req.user` — o que traz
 * o objeto Request inteiro para dentro do handler e abre a porta para ele vazar dali para
 * o service, quebrando a regra de que HTTP para no controller.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>()
    return request.user
  },
)
