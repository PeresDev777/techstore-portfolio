import { Module, forwardRef } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UsersController } from './users.controller'
import { UsersRepository } from './users.repository'
import { UsersService } from './users.service'

/**
 * `forwardRef` resolve uma dependencia circular real entre os modulos:
 *
 *   AuthModule  -> precisa de UsersRepository (login busca o usuario)
 *   UsersModule -> precisa de PasswordService (troca de senha)
 *
 * A alternativa seria extrair um terceiro modulo so para o PasswordService. Com dois
 * modulos e uma unica dependencia cruzada, isso adicionaria uma camada de indirecao para
 * evitar duas linhas — o `forwardRef` e explicito e documenta o ciclo onde ele existe.
 *
 * `exports` declara o contrato do modulo: quem importar UsersModule enxerga o service e o
 * repositorio, e nada mais. O que nao esta aqui e detalhe interno.
 */
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
