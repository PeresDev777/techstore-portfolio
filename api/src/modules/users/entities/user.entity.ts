import { ApiProperty } from '@nestjs/swagger'
import { Role, type User } from '@prisma/client'

/**
 * Forma publica do usuario — o que a API devolve.
 *
 * O mapeamento e uma LISTA DE PERMISSAO explicita, campo a campo, e nao um
 * `delete user.passwordHash` sobre a entidade do Prisma. A diferenca aparece no futuro:
 * quando alguem adicionar uma coluna sensivel ao schema (um token de recuperacao, um
 * documento), a abordagem por remocao passa a vazar automaticamente, e esta aqui continua
 * devolvendo exatamente os cinco campos abaixo.
 *
 * Vale notar que `frontend/src/types/user.ts` ja documenta esta mesma fronteira do lado
 * do cliente: "NAO existe campo de senha aqui".
 */
export class UserEntity {
  @ApiProperty({ example: 'usr-001' })
  id: string

  @ApiProperty({ example: 'Gabriel Peres' })
  name: string

  @ApiProperty({ example: 'qa@techstore.com' })
  email: string

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role: Role

  @ApiProperty({ example: '2026-08-05T21:00:00.000Z' })
  createdAt: Date

  static from(user: User): UserEntity {
    const entity = new UserEntity()

    entity.id = user.id
    entity.name = user.name
    entity.email = user.email
    entity.role = user.role
    entity.createdAt = user.createdAt

    return entity
  }

  static fromMany(users: User[]): UserEntity[] {
    return users.map((user) => UserEntity.from(user))
  }
}
