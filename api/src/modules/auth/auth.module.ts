import { Module, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { UsersModule } from '../users/users.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'
import { PasswordService } from './password.service'
import { RefreshTokenRepository } from './refresh-token.repository'
import { JwtStrategy } from './strategies/jwt.strategy'
import { TokenService } from './token.service'

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,

    /*
     * `registerAsync` e nao `register`: a configuracao depende do ConfigService, que so
     * existe depois que o ConfigModule inicializou e VALIDOU o ambiente. Registrado de
     * forma sincrona, o segredo seria lido de `process.env` antes da validacao rodar — e
     * um segredo ausente viraria `undefined`, com o jsonwebtoken assinando com a string
     * "undefined" em vez de falhar.
     */
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.accessSecret'),
        signOptions: {
          expiresIn: config.getOrThrow<number>('auth.accessTtlSeconds'),
          // Identificam a origem do token. Com varios servicos assinando com o mesmo
          // segredo, sao eles que impedem um token de um servico valer em outro.
          issuer: 'techstore-api',
          audience: 'techstore-app',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    RefreshTokenRepository,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  // PasswordService sai para o UsersModule (troca de senha); os guards saem para serem
  // registrados globalmente no AppModule.
  exports: [PasswordService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
