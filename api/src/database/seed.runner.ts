import type { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { deriveProductFields } from '../modules/products/product-derived-fields'
import { BCRYPT_ROUNDS, CATEGORIES, PRODUCTS, USERS } from './seed-data'

/**
 * Semeia o banco com a massa de contrato.
 *
 * Vive em `src/` e nao em `prisma/` porque tem DOIS consumidores:
 *
 * 1. `prisma/seed.ts` — o script de linha de comando (`npm run db:seed`).
 * 2. `TestSupportService` — o endpoint `POST /api/test/reset`, que a suite de automacao
 *    usa para voltar ao estado conhecido entre cenarios.
 *
 * Antes deste refactor a logica existia so no script, e o endpoint de reset teria de
 * duplica-la. Duas copias do seed divergem na primeira alteracao de massa, e o sintoma
 * seria o pior possivel: testes que passam localmente e falham no CI, ou o contrario.
 *
 * Recebe o cliente por parametro em vez de instanciar o proprio: o script passa um
 * `PrismaClient` novo, o servico passa o `PrismaService` da aplicacao. A funcao nao
 * precisa saber a diferenca.
 */

export interface SeedSummary {
  categories: number
  users: number
  products: number
}

/**
 * Tabelas na ordem de dependencia, para o TRUNCATE do reset.
 * `CASCADE` resolveria a ordem sozinho, mas listar explicitamente documenta o grafo — e
 * uma tabela nova esquecida aqui aparece como dado sobrevivente entre testes.
 */
export const SEEDED_TABLES = [
  'order_items',
  'orders',
  'cart_items',
  'carts',
  'refresh_tokens',
  'products',
  'categories',
  'users',
] as const

export async function runSeed(prisma: PrismaClient): Promise<SeedSummary> {
  const categoryIds = new Map<string, string>()

  for (const category of CATEGORIES) {
    const saved = await prisma.category.upsert({
      where: { id: category.id },
      update: { name: category.name, slug: category.slug },
      create: { id: category.id, name: category.name, slug: category.slug },
    })

    categoryIds.set(category.name, saved.id)
  }

  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS)

    /*
     * O hash NAO entra no `update`. bcrypt gera um salt novo a cada chamada, entao
     * reexecutar o seed produziria um hash diferente e uma escrita inutil a cada rodada.
     */
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        deletedAt: null,
      },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        isActive: user.isActive,
      },
    })
  }

  for (const product of PRODUCTS) {
    const categoryId = categoryIds.get(product.category)

    if (!categoryId) {
      throw new Error(`Categoria "${product.category}" nao existe no seed (produto ${product.id}).`)
    }

    const data = {
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      description: product.description,
      priceInCents: product.priceInCents,
      rating: product.rating,
      reviewCount: product.reviewCount,
      imageUrl: product.imageUrl,
      stock: product.stock,
      isActive: true,
      /*
       * Os campos derivados — indice de busca, relevancia e chave de ordenacao — vem da
       * MESMA funcao que a rota de criacao de produto usa.
       *
       * Uma copia da formula aqui divergiria da regra real na primeira alteracao, e o
       * sintoma seria peculiar: busca e ordenacao funcionando para produto cadastrado pela
       * API e falhando para produto do seed. Exatamente o tipo de diferenca que faz um
       * teste passar local e falhar no CI.
       */
      ...deriveProductFields(product, product.category),
      categoryId,
    }

    await prisma.product.upsert({
      where: { id: product.id },
      update: data,
      create: { id: product.id, ...data },
    })
  }

  return { categories: CATEGORIES.length, users: USERS.length, products: PRODUCTS.length }
}

/**
 * Apaga TODOS os dados e semeia de novo.
 *
 * `TRUNCATE` e nao `DELETE`: nao percorre linha a linha, nao dispara triggers e libera o
 * espaco imediatamente — em um reset entre cenarios de teste, a diferenca de tempo aparece.
 *
 * O `upsert` do seed sozinho nao bastaria: ele restaura a massa de contrato, mas nao
 * remove o que os testes criaram (pedidos, carrinhos, usuarios cadastrados no caminho).
 * Um teste que conta "3 pedidos" falharia na segunda execucao da suite.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<SeedSummary> {
  const tables = SEEDED_TABLES.map((table) => `"${table}"`).join(', ')

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`)

  return runSeed(prisma)
}
