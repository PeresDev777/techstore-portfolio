import { Module, type DynamicModule } from '@nestjs/common'
import { Environment } from '../../config/env.validation'
import { TestSupportController } from './test-support.controller'
import { TestSupportService } from './test-support.service'

/**
 * Modulo condicional: existe em desenvolvimento e teste, nao existe em producao.
 *
 * `register()` devolve um modulo VAZIO quando `NODE_ENV=production` — sem controller, sem
 * provider, sem rota. Nao ha `if` em runtime a ser contornado, nem guard a ser esquecido:
 * o endpoint simplesmente nao foi montado.
 *
 * A leitura e de `process.env` direto, e nao do ConfigService, porque a decisao acontece
 * na CONSTRUCAO do grafo de modulos — antes de qualquer injecao de dependencia existir.
 * E a unica leitura direta de ambiente fora de `config/`, e esta e a razao.
 */
@Module({})
export class TestSupportModule {
  static register(): DynamicModule {
    const isProduction = process.env.NODE_ENV === Environment.Production

    if (isProduction) {
      return { module: TestSupportModule }
    }

    return {
      module: TestSupportModule,
      controllers: [TestSupportController],
      providers: [TestSupportService],
    }
  }
}
