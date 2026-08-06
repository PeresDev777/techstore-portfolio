import { Injectable, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import type { Observable } from 'rxjs'
import { unauthenticated } from '../../../common/exceptions/domain.exceptions'
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator'

/**
 * Guard global de autenticacao.
 *
 * Registrado em AppModule via APP_GUARD, ele protege TODA rota; `@Public()` e a unica
 * forma de escapar. Fechado por padrao — ver o raciocinio em `public.decorator.ts`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) return true

    return super.canActivate(context)
  }

  /**
   * Traduz a falha do Passport para o formato de erro da API.
   *
   * Sem isto, o Nest devolveria seu 401 padrao com `message: "Unauthorized"` — sem `code`,
   * o que obrigaria o cliente e os testes a tratar essa rota de forma diferente de todas
   * as outras. Um formato de erro que tem excecoes nao e um formato.
   *
   * A mensagem NAO distingue "token ausente", "token malformado" e "token expirado": a
   * acao do cliente e a mesma nos tres casos (renovar ou logar), e detalhar so ajuda quem
   * esta sondando a API.
   */
  override handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw unauthenticated('Autenticação necessária.')
    }

    return user
  }
}
