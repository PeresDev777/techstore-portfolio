import { PrismaClient } from '@prisma/client'
import { BCRYPT_ROUNDS } from '../src/database/seed-data'
import { runSeed } from '../src/database/seed.runner'

/**
 * Ponto de entrada do `npm run db:seed` (e do `prisma migrate reset`).
 *
 * Toda a logica vive em `src/database/seed.runner.ts`, compartilhada com o endpoint
 * `POST /api/test/reset`. Este arquivo e apenas a casca de linha de comando: abre a
 * conexao, chama o seed, imprime o resumo e fecha.
 *
 * A massa em si e um CONTRATO com a suite de automacao — ids fixos (`usr-001`, `prd-001`),
 * senhas conhecidas e precos exatos. Ver `src/database/seed-data.ts`.
 */
const prisma = new PrismaClient()

async function main(): Promise<void> {
  console.log(`Seed iniciado (bcrypt rounds: ${BCRYPT_ROUNDS})`)

  const summary = await runSeed(prisma)

  console.log(`  categorias: ${summary.categories}`)
  console.log(`  usuarios:   ${summary.users}`)
  console.log(`  produtos:   ${summary.products}`)
  console.log('Seed concluido.')
}

main()
  .catch((error: unknown) => {
    console.error('Seed falhou:', error)
    // Codigo de saida diferente de zero: sem isto, um seed quebrado em pipeline passaria
    // como sucesso e os testes falhariam depois, longe da causa.
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
