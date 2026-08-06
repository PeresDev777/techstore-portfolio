import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { resetDatabase, type SeedSummary } from '../../database/seed.runner'

@Injectable()
export class TestSupportService {
  private readonly logger = new Logger(TestSupportService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reinicia o banco.
   *
   * O log em nivel WARN e proposital: apagar todos os dados nunca deve passar
   * despercebido em um log, mesmo em ambiente de teste. Se isso aparecer em um ambiente
   * onde nao deveria, o registro e a primeira pista.
   */
  async reset(): Promise<SeedSummary> {
    this.logger.warn('Reset do banco solicitado — todos os dados serao apagados.')

    const summary = await resetDatabase(this.prisma)

    this.logger.warn(
      `Reset concluido: ${summary.categories} categorias, ${summary.users} usuarios, ` +
        `${summary.products} produtos.`,
    )

    return summary
  }
}
