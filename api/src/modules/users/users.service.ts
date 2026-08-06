import { Injectable } from '@nestjs/common'
import { conflict, notFound } from '../../common/exceptions/domain.exceptions'
import { PaginatedResult } from '../../common/dto/paginated-result'
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto'
import { PasswordService } from '../auth/password.service'
import type { ChangePasswordDto } from './dto/change-password.dto'
import type { UpdateProfileDto } from './dto/update-profile.dto'
import { UserEntity } from './entities/user.entity'
import { UsersRepository } from './users.repository'

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
  ) {}

  async findById(id: string): Promise<UserEntity> {
    const user = await this.users.findById(id)

    if (!user) {
      throw notFound('Usuário não encontrado.')
    }

    return UserEntity.from(user)
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<UserEntity>> {
    const [users, total] = await this.users.findManyPaginated(query.skip, query.limit)

    return PaginatedResult.create(UserEntity.fromMany(users), total, query.page, query.limit)
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<UserEntity> {
    if (dto.email) {
      const current = await this.users.findById(id)

      // Só checa colisão se o e-mail realmente mudou: sem isto, salvar o perfil sem
      // alterar o e-mail acusaria conflito com a própria conta.
      if (current && current.email !== dto.email && (await this.users.emailExists(dto.email))) {
        throw conflict('Este e-mail já está cadastrado.', [
          { field: 'email', message: 'E-mail já cadastrado.' },
        ])
      }
    }

    const updated = await this.users.update(id, { name: dto.name, email: dto.email })

    return UserEntity.from(updated)
  }

  /**
   * Troca de senha exige a senha atual.
   *
   * Sem isso, quem roubasse um access token — 15 minutos de janela — trocaria a senha da
   * vítima sem conhecê-la, assumindo a conta por completo. Exigir a senha atual limita o
   * estrago do token roubado ao que ele já permite.
   */
  async changePassword(id: string, dto: ChangePasswordDto): Promise<null> {
    const user = await this.users.findById(id)

    if (!user) {
      throw notFound('Usuário não encontrado.')
    }

    const matches = await this.passwords.compare(dto.currentPassword, user.passwordHash)

    if (!matches) {
      throw conflict('A senha atual está incorreta.', [
        { field: 'currentPassword', message: 'Senha atual incorreta.' },
      ])
    }

    await this.users.update(id, { passwordHash: await this.passwords.hash(dto.newPassword) })

    return null
  }

  /** Exclusão lógica. Revoga todas as sessões na mesma transação (ver repositório). */
  async remove(id: string): Promise<null> {
    await this.users.softDelete(id)
    return null
  }
}
