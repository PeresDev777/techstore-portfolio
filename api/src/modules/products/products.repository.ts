import { Injectable } from '@nestjs/common'
import type { Category, Prisma, Product } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { TransactionClient } from '../../prisma/transaction.service'
import { normalizeForSearch } from '../../common/utils/text'
import { PRODUCT_SORT, type ProductSort } from './dto/product-query.dto'

export type ProductWithCategory = Product & { category: Category }

export interface ProductFilters {
  search?: string
  categoryId?: string
  inStock?: boolean
  sort: ProductSort
  skip: number
  take: number
}

/**
 * Ordenacoes suportadas.
 *
 * TODAS terminam com `{ id: 'asc' }`. Sem esse desempate, dois produtos com o mesmo preco
 * (ou a mesma nota) saem em ordem indefinida — o Postgres nao promete estabilidade — e o
 * resultado muda entre execucoes. Numa suite automatizada isso e o teste que passa nove
 * vezes e falha na decima, o pior tipo de defeito para depurar.
 */
const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  [PRODUCT_SORT.relevance]: [{ relevanceScore: 'desc' }, { id: 'asc' }],
  [PRODUCT_SORT.priceAsc]: [{ priceInCents: 'asc' }, { id: 'asc' }],
  [PRODUCT_SORT.priceDesc]: [{ priceInCents: 'desc' }, { id: 'asc' }],
  [PRODUCT_SORT.ratingDesc]: [{ rating: 'desc' }, { id: 'asc' }],
  [PRODUCT_SORT.nameAsc]: [{ nameSort: 'asc' }, { id: 'asc' }],
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listagem filtrada e paginada.
   *
   * A contagem e a pagina vao na MESMA transacao: executadas soltas, um cadastro entre uma
   * e outra produz um `total` que nao corresponde aos itens devolvidos.
   */
  findManyPaginated(filters: ProductFilters): Promise<[ProductWithCategory[], number]> {
    const where = this.buildWhere(filters)

    return this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: ORDER_BY[filters.sort],
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.product.count({ where }),
    ])
  }

  /**
   * Busca por id OU slug no mesmo endpoint.
   *
   * O frontend navega por slug (URL legivel, boa para SEO) e a suite de automacao assevera
   * por id (`prd-001`, estavel e curto). Exigir endpoints separados obrigaria o cliente a
   * saber de antemao qual identificador tem em maos — os dois sao unicos e nao colidem.
   */
  findByIdOrSlug(identifier: string, onlyActive = true): Promise<ProductWithCategory | null> {
    return this.prisma.product.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
        ...(onlyActive ? { isActive: true } : {}),
      },
      include: { category: true },
    })
  }

  /** Produtos da mesma categoria, exceto o proprio. Alimenta o bloco "relacionados". */
  findRelated(product: Product, limit: number): Promise<ProductWithCategory[]> {
    return this.prisma.product.findMany({
      where: { categoryId: product.categoryId, id: { not: product.id }, isActive: true },
      include: { category: true },
      orderBy: [{ relevanceScore: 'desc' }, { id: 'asc' }],
      take: limit,
    })
  }

  slugExists(slug: string, exceptId?: string): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    })
  }

  create(data: Prisma.ProductCreateInput): Promise<ProductWithCategory> {
    return this.prisma.product.create({ data, include: { category: true } })
  }

  update(id: string, data: Prisma.ProductUpdateInput): Promise<ProductWithCategory> {
    return this.prisma.product.update({ where: { id }, data, include: { category: true } })
  }

  /**
   * Retirada de catalogo — `isActive: false`, nao DELETE.
   *
   * Um produto e referenciado por carrinhos e por itens de pedido. A remocao fisica
   * funcionaria (as chaves estrangeiras preveem isso: Cascade nos carrinhos, SetNull nos
   * pedidos), mas apagaria o vinculo de pedidos historicos com o catalogo sem necessidade.
   * "Sair de venda" e a operacao de negocio real; "sumir do banco" quase nunca e.
   */
  async deactivate(id: string): Promise<void> {
    await this.prisma.product.update({ where: { id }, data: { isActive: false } })
  }

  /**
   * Baixa de estoque com GUARDA CONDICIONAL. Devolve `false` se nao havia saldo.
   *
   * Esta e a linha que impede vender o mesmo item duas vezes. O `where` inclui
   * `stock >= quantity`, entao o proprio UPDATE decide se pode acontecer:
   *
   *   UPDATE products SET stock = stock - 2 WHERE id = 'prd-004' AND stock >= 2
   *
   * O Postgres adquire o lock da linha e REAVALIA a condicao depois de esperar — mesmo em
   * READ COMMITTED, que e o nivel padrao. Duas transacoes disputando a ultima unidade sao
   * serializadas pelo lock, e a segunda encontra `stock = 0`, nao satisfaz o `where` e
   * afeta zero linhas.
   *
   * A alternativa ingenua — ler o estoque, comparar em JavaScript, depois gravar — tem uma
   * janela entre a leitura e a escrita onde outra transacao passa. E o bug classico de
   * e-commerce: o teste manual nunca pega, e a Black Friday pega.
   */
  async decrementStock(
    productId: string,
    quantity: number,
    tx?: TransactionClient,
  ): Promise<boolean> {
    const db = tx ?? this.prisma

    const result = await db.product.updateMany({
      where: { id: productId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    })

    return result.count > 0
  }

  /** Devolucao de estoque no cancelamento. Sem guarda: somar nunca viola limite. */
  async restoreStock(productId: string, quantity: number, tx?: TransactionClient): Promise<void> {
    const db = tx ?? this.prisma

    await db.product.updateMany({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    })
  }

  private buildWhere(filters: ProductFilters): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { isActive: true }

    if (filters.categoryId) where.categoryId = filters.categoryId

    // "Com estoque" e `stock > 0`. `stock >= 1` diria o mesmo; a intencao fica mais clara.
    if (filters.inStock) where.stock = { gt: 0 }

    if (filters.search) {
      /*
       * Cada termo precisa aparecer no indice normalizado — AND, nao OR.
       *
       * Com OR, "notebook vertex" devolveria todo notebook e todo produto da marca Vertex,
       * ou seja, MAIS resultados quanto mais especifica a busca. O comportamento esperado
       * pelo usuario e o oposto, e e o que a suite assevera: "vertex notebook" e
       * "notebook vertex" devolvem os mesmos 2 produtos.
       */
      const terms = normalizeForSearch(filters.search).split(/\s+/).filter(Boolean)

      if (terms.length > 0) {
        where.AND = terms.map((term) => ({ searchIndex: { contains: term } }))
      }
    }

    return where
  }
}
