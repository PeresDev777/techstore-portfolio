import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'auth:public'

/**
 * Libera uma rota da autenticacao obrigatoria.
 *
 * A API e **fechada por padrao**: o JwtAuthGuard e global, entao toda rota exige token a
 * menos que declare o contrario. O inverso — abrir tudo e proteger com `@UseGuards` rota a
 * rota — parece equivalente e nao e: o modo de falha muda de lado.
 *
 * Esquecer `@Public()` numa rota publica gera um 401 obvio, reportado no primeiro teste.
 * Esquecer `@UseGuards()` numa rota privada gera um endpoint aberto que ninguem percebe —
 * ate alguem de fora perceber.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
