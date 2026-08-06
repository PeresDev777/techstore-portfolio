import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaClient } from '@prisma/client'

/**
 * O PrismaClient como provider injetavel.
 *
 * Por que envolver em um servico do Nest em vez de exportar uma instancia global?
 *
 * - CICLO DE VIDA: `onModuleInit`/`onModuleDestroy` amarram a conexao ao ciclo da
 *   aplicacao. Com `enableShutdownHooks` no bootstrap, um SIGTERM do Docker fecha o pool
 *   de conexoes antes do processo morrer, em vez de deixar conexoes penduradas no
 *   Postgres ate o timeout.
 * - TESTABILIDADE: qualquer repositorio recebe o PrismaService pelo construtor, entao um
 *   teste pode injetar um dublê sem monkey-patch de modulo.
 * - CONFIGURACAO UNICA: a URL vem do ConfigService validado, nao de `process.env` lido em
 *   um canto qualquer do codigo.
 *
 * Estende PrismaClient de proposito: o repositorio usa `prisma.product.findMany()`
 * normalmente, sem uma camada de repasse que so existiria para repassar.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService) {
    super({
      datasourceUrl: config.getOrThrow<string>('database.url'),
      // `query` fica de fora ate na Sprint 2: com modelos e joins reais ele vira a
      // ferramenta para caçar N+1, mas antes disso e so ruido no terminal.
      log: ['warn', 'error'],
    })
  }

  /**
   * A conexao e aquecida no boot, mas a FALHA nao derruba o processo.
   *
   * Parece contradizer o "falhe alto e cedo" do env.validation, e a diferenca importa:
   * configuracao ausente e defeito do deploy, e nunca vai se resolver sozinha — o processo
   * deve morrer. Banco indisponivel e uma condicao TRANSIToria (Postgres reiniciando,
   * failover, rede oscilando) que se resolve sozinha em segundos.
   *
   * Se o boot morresse aqui, um orquestrador entraria em CrashLoopBackOff durante um
   * restart de banco de 10 segundos, e a API voltaria minutos depois do banco. Subindo
   * mesmo assim, o readiness reporta indisponivel, o balanceador tira a instancia de
   * rotacao, e ela volta sozinha quando o banco voltar — sem intervencao humana.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect()
      this.logger.log('Conexao com o Postgres estabelecida.')
    } catch (error) {
      this.logger.error(
        'Falha ao conectar no Postgres no boot. A API sobe; /api/health/ready reportara indisponivel.',
        error instanceof Error ? error.stack : String(error),
      )
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
