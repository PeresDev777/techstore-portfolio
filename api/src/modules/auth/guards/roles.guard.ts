import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Role } from '@prisma/client'
import type { Request } from 'express'
import { forbidden } from '../../../common/exceptions/domain.exceptions'
import { ROLES_KEY } from '../../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '../../../common/types/authenticated-user'

/**
 * Autorizacao por papel.
 *
 * Roda DEPOIS do JwtAuthGuard (ordem definida em AppModule), entao pode contar com
 * `request.user` preenchido. Se rodasse antes, veria `undefined` e recusaria todo mundo.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Rota sem @Roles nao restringe papel — autenticacao ja foi exigida pelo guard anterior.
    if (!required?.length) return true

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    const user = request.user

    /*
     * 403 e nao 401, e a distincao e a mais confundida em API REST:
     *   401 = nao sei quem voce e     -> o cliente deve autenticar/renovar
     *   403 = sei, e voce nao pode    -> renovar o token nao muda nada
     *
     * Responder 401 aqui faria um cliente bem escrito entrar em laco: renova o token,
     * tenta de novo, leva 401, renova o token...
     */
    if (!user || !required.includes(user.role)) {
      throw forbidden('Você não tem permissão para executar esta ação.')
    }

    return true
  }
}
