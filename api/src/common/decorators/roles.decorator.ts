import { SetMetadata } from '@nestjs/common'
import type { Role } from '@prisma/client'

export const ROLES_KEY = 'auth:roles'

/**
 * Restringe a rota aos papeis informados.
 *
 *   @Roles('ADMIN')
 *   @Delete(':id')
 *   remove() { ... }
 *
 * Autorizacao declarada junto da rota, e nao dentro do service, por um motivo pratico:
 * quem le o controller ve quem pode chamar aquilo sem abrir mais nenhum arquivo. Regra de
 * acesso escondida no meio de regra de negocio e onde brechas se acumulam.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)
