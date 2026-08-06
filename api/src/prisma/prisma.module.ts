import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

/**
 * `@Global()` e uma excecao consciente a regra de "todo modulo declara o que usa".
 *
 * O acesso a dados e uma dependencia transversal: sem isto, todo modulo de dominio
 * precisaria importar PrismaModule explicitamente, e o import viraria ruido repetido em
 * vinte arquivos sem informar nada.
 *
 * A regra que MANTEMOS: apenas repositorios injetam PrismaService. Um service de dominio
 * que chama `prisma.*` diretamente esta furando a arquitetura em camadas, e o fato de o
 * modulo ser global nao autoriza isso — e revisao de codigo, nao restricao do framework.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
